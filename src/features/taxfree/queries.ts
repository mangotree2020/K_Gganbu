// 사후면세 환급 (#26 Phase 2) — tax_free_receipts CRUD + 영수증 스캔(receipt-ocr).
// 수동 입력은 클라이언트 직접 insert(user_id DB 기본값 current_user_id()), 스캔은 Edge Function.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { estimateRefund, type Receipt } from './types'

function mapRow(d: Record<string, unknown>): Receipt {
  return {
    id: d.id as string,
    storeName: (d.store_name as string | null) ?? null,
    purchaseDate: (d.purchase_date as string | null) ?? null,
    totalAmount: Number(d.total_amount ?? 0),
    currency: (d.currency as string) ?? 'KRW',
    vatRefund: Number(d.vat_refund ?? 0),
    imagePath: (d.image_path as string | null) ?? null,
    source: (d.source as 'manual' | 'scanned') ?? 'manual',
    status: (d.status as 'saved' | 'claimed') ?? 'saved',
    createdAt: (d.created_at as string) ?? '',
  }
}

const SELECT =
  'id, store_name, purchase_date, total_amount, currency, vat_refund, image_path, source, status, created_at'

// 본인 영수증 목록 (구매일 최신순)
export function useReceipts() {
  return useQuery({
    queryKey: ['tax-free-receipts'],
    queryFn: async (): Promise<Receipt[]> => {
      const { data, error } = await supabase
        .from('tax_free_receipts')
        .select(SELECT)
        .order('purchase_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map(mapRow)
    },
  })
}

// 수동 영수증 추가 — vat_refund 는 클라에서 추정 계산하여 저장(목록 집계 일관성).
export function useAddReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      storeName: string
      totalAmount: number
      purchaseDate?: string | null
    }) => {
      const { error } = await supabase.from('tax_free_receipts').insert({
        store_name: input.storeName,
        total_amount: input.totalAmount,
        purchase_date: input.purchaseDate ?? null,
        vat_refund: estimateRefund(input.totalAmount),
        source: 'manual',
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-free-receipts'] }),
  })
}

export type ScanReceiptResult = {
  success: boolean
  receipt_id: string | null
  data: { storeName: string | null; totalAmount: number; purchaseDate: string | null } | null
  error: string | null
}

// 영수증 촬영/선택 → base64 → receipt-ocr 호출. 취소 시 null.
export function useScanReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (source: 'camera' | 'library'): Promise<ScanReceiptResult | null> => {
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

      const { data, error } = await supabase.functions.invoke('receipt-ocr', {
        body: { imageBase64: res.assets[0].base64, mimeType: 'image/jpeg' },
      })
      if (error) throw error
      return data as ScanReceiptResult
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-free-receipts'] }),
  })
}

export function useRemoveReceipt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_free_receipts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-free-receipts'] }),
  })
}
