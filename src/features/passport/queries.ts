// 여권 OCR (#26) — passport_data 조회 + 스캔(촬영→passport-ocr Edge Function)·삭제.
// 쓰기는 Edge Function(service role). 클라이언트는 본인 데이터만 read/delete (RLS).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'

export type Passport = {
  id: string
  surname: string | null
  givenName: string | null
  nationality: string | null
  passportNumber: string | null
  dateOfBirth: string | null
  sex: string | null
  expiryDate: string | null
  isValid: boolean
}

export type ScanResult = {
  success: boolean
  scan_id: string
  is_valid: boolean
  data: unknown
  error: string | null
}

// 현재 사용자의 최신 등록 여권(없으면 null)
export function usePassport() {
  return useQuery({
    queryKey: ['passport'],
    queryFn: async (): Promise<Passport | null> => {
      const { data, error } = await supabase
        .from('passport_data')
        .select(
          'id, surname, given_name, nationality, passport_number, date_of_birth, sex, expiry_date, is_valid',
        )
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error || !data) return null
      return {
        id: data.id as string,
        surname: data.surname as string | null,
        givenName: data.given_name as string | null,
        nationality: data.nationality as string | null,
        passportNumber: data.passport_number as string | null,
        dateOfBirth: data.date_of_birth as string | null,
        sex: data.sex as string | null,
        expiryDate: data.expiry_date as string | null,
        isValid: !!data.is_valid,
      }
    },
  })
}

// 여권 촬영/선택 → base64 → passport-ocr 호출. 취소 시 null.
export function useScanPassport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (source: 'camera' | 'library'): Promise<ScanResult | null> => {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) throw new Error('permission_denied')

      const opts: ImagePicker.ImagePickerOptions = { base64: true, quality: 0.8 }
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync(opts)
      if (res.canceled || !res.assets?.[0]?.base64) return null

      const { data, error } = await supabase.functions.invoke('passport-ocr', {
        body: { imageBase64: res.assets[0].base64, mimeType: 'image/jpeg' },
      })
      if (error) throw error
      return data as ScanResult
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['passport'] }),
  })
}

// 등록 여권 삭제(본인 scans 전체 → cascade로 data·이미지 메타 정리)
export function useRemovePassport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('passport_scans').delete().not('id', 'is', null)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['passport'] }),
  })
}
