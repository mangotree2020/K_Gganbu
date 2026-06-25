# Passport OCR — 구현 태스크

## 개요

여권 MRZ(Machine Readable Zone) 자동 인식 기능.
React Native 앱에서 카메라로 여권 촬영 → Supabase Edge Function → Google Cloud Vision API → mrz 파싱 → DB 저장.

---

## 기술 스택

| 레이어   | 기술                                              |
| -------- | ------------------------------------------------- |
| 앱 (RN)  | Expo Camera / expo-image-picker, expo-file-system |
| API      | Supabase Edge Function (Deno)                     |
| OCR      | Google Cloud Vision API (TEXT_DETECTION)          |
| MRZ 파싱 | mrz npm 라이브러리                                |
| 저장소   | Supabase Storage (passport-images bucket)         |
| DB       | Supabase PostgreSQL                               |

---

## 구현 순서

1. Supabase DB 스키마 생성
2. Storage bucket + RLS 설정
3. Edge Function 작성 및 배포
4. React Native hook 작성
5. Web Admin 페이지 (스캔 목록 + 재처리)

---

## Step 1. DB 스키마

Supabase SQL Editor에서 실행.

```sql
-- 여권 스캔 원본 테이블
CREATE TABLE passport_scans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  image_path    text NOT NULL,
  raw_mrz       text,
  ocr_raw       jsonb,
  status        text DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error_message text,
  created_at    timestamptz DEFAULT now()
);

-- 파싱된 여권 데이터 테이블
CREATE TABLE passport_data (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         uuid REFERENCES passport_scans(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  surname         text,
  given_name      text,
  nationality     text,
  passport_number text,
  date_of_birth   date,
  sex             text CHECK (sex IN ('M', 'F', '<')),
  expiry_date     date,
  personal_number text,
  is_valid        boolean DEFAULT false,
  parsed_at       timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_passport_scans_user_id ON passport_scans(user_id);
CREATE INDEX idx_passport_scans_status  ON passport_scans(status);
CREATE INDEX idx_passport_data_user_id  ON passport_data(user_id);
CREATE INDEX idx_passport_data_scan_id  ON passport_data(scan_id);

-- RLS 활성화
ALTER TABLE passport_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_data  ENABLE ROW LEVEL SECURITY;

-- RLS 정책 — 본인 데이터만
CREATE POLICY "본인 scans 접근" ON passport_scans
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "본인 data 접근" ON passport_data
  FOR ALL USING (auth.uid() = user_id);

-- Admin 정책 (Web Admin용 service_role은 RLS 우회하므로 별도 불필요)
```

---

## Step 2. Storage Bucket 설정

Supabase Dashboard → Storage → New bucket

```
Bucket name : passport-images
Public      : OFF (Private)
```

SQL로 Storage RLS 설정:

```sql
-- 본인 폴더만 업로드/조회 허용
CREATE POLICY "본인 이미지 업로드" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'passport-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "본인 이미지 조회" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'passport-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "본인 이미지 삭제" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'passport-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## Step 3. Supabase Edge Function

### 3-1. Secret 등록

```bash
supabase secrets set GOOGLE_VISION_API_KEY=your_key_here
```

SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY는 Edge Function 런타임에서 자동 주입됨.

### 3-2. 함수 생성

```bash
supabase functions new passport-ocr
```

### 3-3. 함수 코드

`supabase/functions/passport-ocr/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse as parseMRZ } from 'npm:mrz'

const VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 인증
  const authHeader = req.headers.get('Authorization') ?? ''
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let imageBase64: string
  let mimeType: string

  try {
    const body = await req.json()
    imageBase64 = body.imageBase64
    mimeType = body.mimeType ?? 'image/jpeg'
    if (!imageBase64) throw new Error('imageBase64 required')
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 1. Storage 업로드
  const fileName = `${user.id}/${Date.now()}.jpg`
  const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0))

  const { error: uploadError } = await supabase.storage
    .from('passport-images')
    .upload(fileName, imageBytes, { contentType: mimeType, upsert: false })

  if (uploadError) {
    return new Response(
      JSON.stringify({ error: 'Storage upload failed', detail: uploadError.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  // 2. scan 레코드 생성 (pending)
  const { data: scan, error: scanInsertError } = await supabase
    .from('passport_scans')
    .insert({ user_id: user.id, image_path: fileName, status: 'pending' })
    .select()
    .single()

  if (scanInsertError || !scan) {
    return new Response(JSON.stringify({ error: 'DB insert failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 3. Google Vision API 호출
  let visionData: any
  try {
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
              imageContext: { languageHints: ['en'] },
            },
          ],
        }),
      },
    )
    visionData = await visionRes.json()
  } catch (e) {
    await supabase
      .from('passport_scans')
      .update({
        status: 'failed',
        error_message: 'Vision API 호출 실패',
      })
      .eq('id', scan.id)

    return new Response(JSON.stringify({ error: 'Vision API failed' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const fullText: string = visionData.responses?.[0]?.fullTextAnnotation?.text ?? ''

  // 4. MRZ 라인 추출 (TD3: 44자 라인 2개)
  const lines = fullText.split('\n').map((l: string) => l.trim().replace(/\s+/g, ''))
  const mrzLines = lines.filter((l: string) => /^[A-Z0-9<]{44}$/.test(l))

  let parsedData: any = null
  let isValid: boolean = false
  let parseError: string | null = null

  if (mrzLines.length >= 2) {
    try {
      parsedData = parseMRZ(mrzLines.slice(0, 2))
      isValid = parsedData.valid ?? false
    } catch (e: any) {
      parseError = e.message ?? 'MRZ parse error'
    }
  } else {
    parseError = `MRZ 라인 감지 실패 (감지된 라인 수: ${mrzLines.length})`
  }

  // 5. scan 레코드 업데이트
  await supabase
    .from('passport_scans')
    .update({
      raw_mrz: mrzLines.join('\n') || null,
      ocr_raw: visionData,
      status: parsedData ? 'success' : 'failed',
      error_message: parseError,
    })
    .eq('id', scan.id)

  // 6. passport_data 저장
  if (parsedData?.fields) {
    const f = parsedData.fields
    await supabase.from('passport_data').insert({
      scan_id: scan.id,
      user_id: user.id,
      surname: f.lastName ?? null,
      given_name: f.firstName ?? null,
      nationality: f.nationality ?? null,
      passport_number: f.documentNumber ?? null,
      date_of_birth: formatMRZDate(f.birthDate),
      sex: f.sex ?? null,
      expiry_date: formatMRZDate(f.expirationDate),
      personal_number: f.personalNumber ?? null,
      is_valid: isValid,
    })
  }

  return new Response(
    JSON.stringify({
      success: !!parsedData,
      scan_id: scan.id,
      is_valid: isValid,
      data: parsedData?.fields ?? null,
      error: parseError,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})

function formatMRZDate(yymmdd: string | null | undefined): string | null {
  if (!yymmdd || yymmdd.length !== 6 || yymmdd.includes('<')) return null
  const yy = parseInt(yymmdd.slice(0, 2))
  const mm = yymmdd.slice(2, 4)
  const dd = yymmdd.slice(4, 6)
  const yyyy = yy > 30 ? `19${String(yy).padStart(2, '0')}` : `20${String(yy).padStart(2, '0')}`
  return `${yyyy}-${mm}-${dd}`
}
```

### 3-4. 배포

```bash
supabase functions deploy passport-ocr --no-verify-jwt
```

> `--no-verify-jwt` 제거하면 Supabase가 JWT를 자동 검증함. 함수 내부에서 직접 검증하므로 제거해도 무방.

---

## Step 4. React Native Hook

### 4-1. 패키지 설치

```bash
npx expo install expo-image-picker expo-file-system
```

### 4-2. app.json 권한 추가

```json
{
  "expo": {
    "plugins": [
      [
        "expo-image-picker",
        {
          "cameraPermission": "여권 촬영을 위해 카메라 접근이 필요합니다.",
          "photosPermission": "여권 이미지 선택을 위해 사진 접근이 필요합니다."
        }
      ]
    ]
  }
}
```

### 4-3. Hook 코드

`hooks/usePassportScan.ts`

```typescript
import { useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { supabase } from '@/lib/supabase'

export interface PassportScanResult {
  success: boolean
  scan_id: string
  is_valid: boolean
  data: PassportFields | null
  error: string | null
}

export interface PassportFields {
  lastName: string
  firstName: string
  nationality: string
  documentNumber: string
  birthDate: string
  sex: string
  expirationDate: string
  personalNumber: string | null
}

export function usePassportScan() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scan = async (
    source: 'camera' | 'library' = 'camera',
  ): Promise<PassportScanResult | null> => {
    setLoading(true)
    setError(null)

    try {
      // 권한 요청
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync()
        if (status !== 'granted') {
          setError('카메라 권한이 필요합니다.')
          return null
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (status !== 'granted') {
          setError('사진 라이브러리 권한이 필요합니다.')
          return null
        }
      }

      // 이미지 선택/촬영
      const pickerResult =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.9,
              allowsEditing: true,
              aspect: [3, 2], // 여권 비율 근사값
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.9,
            })

      if (pickerResult.canceled) return null

      // Base64 변환
      const base64 = await FileSystem.readAsStringAsync(pickerResult.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      // Supabase 세션
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setError('로그인이 필요합니다.')
        return null
      }

      // Edge Function 호출
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/passport-ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: 'image/jpeg',
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error ?? `HTTP ${res.status}`)
      }

      const result: PassportScanResult = await res.json()
      return result
    } catch (e: any) {
      const msg = e.message ?? '알 수 없는 오류'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }

  return { scan, loading, error }
}
```

### 4-4. 사용 예시

`screens/PassportScanScreen.tsx`

```typescript
import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { usePassportScan } from "@/hooks/usePassportScan";

export default function PassportScanScreen() {
  const { scan, loading, error } = usePassportScan();

  const handleScan = async () => {
    const result = await scan("camera");
    if (!result) return;

    if (!result.success || !result.is_valid) {
      Alert.alert("인식 실패", result.error ?? "여권을 다시 촬영해주세요.");
      return;
    }

    const d = result.data!;
    Alert.alert(
      "인식 완료",
      `이름: ${d.firstName} ${d.lastName}\n국적: ${d.nationality}\n여권번호: ${d.documentNumber}\n만료일: ${d.expirationDate}`
    );
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
      <TouchableOpacity
        onPress={handleScan}
        disabled={loading}
        style={{
          backgroundColor: "#2563EB",
          paddingHorizontal: 32,
          paddingVertical: 16,
          borderRadius: 12,
        }}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>여권 스캔</Text>
        }
      </TouchableOpacity>
      {error && <Text style={{ color: "red", marginTop: 12 }}>{error}</Text>}
    </View>
  );
}
```

---

## Step 5. Web Admin 페이지

`app/admin/passport-scans/page.tsx` (Next.js 기준)

```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Scan {
  id: string;
  user_id: string;
  status: string;
  error_message: string | null;
  created_at: string;
  passport_data: {
    surname: string;
    given_name: string;
    nationality: string;
    passport_number: string;
    expiry_date: string;
    is_valid: boolean;
  }[];
}

export default function PassportScansPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScans();
  }, []);

  const fetchScans = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("passport_scans")
      .select(`
        id, user_id, status, error_message, created_at,
        passport_data ( surname, given_name, nationality, passport_number, expiry_date, is_valid )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    setScans(data ?? []);
    setLoading(false);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      success: "bg-green-100 text-green-800",
      failed:  "bg-red-100 text-red-800",
      pending: "bg-yellow-100 text-yellow-800",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? ""}`}>
        {status}
      </span>
    );
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Passport Scans</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">이름</th>
            <th className="p-3 text-left">국적</th>
            <th className="p-3 text-left">여권번호</th>
            <th className="p-3 text-left">만료일</th>
            <th className="p-3 text-left">생성일</th>
            <th className="p-3 text-left">오류</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((scan) => {
            const pd = scan.passport_data?.[0];
            return (
              <tr key={scan.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{statusBadge(scan.status)}</td>
                <td className="p-3">{pd ? `${pd.given_name} ${pd.surname}` : "-"}</td>
                <td className="p-3">{pd?.nationality ?? "-"}</td>
                <td className="p-3">{pd?.passport_number ?? "-"}</td>
                <td className="p-3">{pd?.expiry_date ?? "-"}</td>
                <td className="p-3">{new Date(scan.created_at).toLocaleString("ko-KR")}</td>
                <td className="p-3 text-red-500 text-xs">{scan.error_message ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 환경변수 체크리스트

### Supabase Secrets (Edge Function)

```
GOOGLE_VISION_API_KEY   ← Google Cloud Console에서 발급
```

### React Native (.env)

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Web Admin (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 비용 예측

| 월 건수  | Vision API 단가 | 월 비용 |
| -------- | --------------- | ------- |
| 5,000건  | $1.50/1,000건   | ~$7.5   |
| 20,000건 | $1.50/1,000건   | ~$30    |
| 50,000건 | $1.05/1,000건\* | ~$52.5  |

\* 5M~20M 구간 볼륨 할인 적용

---

## 주의사항

- 여권 이미지는 개인정보보호법상 민감정보 — Storage bucket은 반드시 Private 유지
- RLS 정책 누락 시 전체 사용자 데이터 노출 위험 — 배포 전 반드시 확인
- Vision API 키는 서버사이드(Edge Function)에서만 사용, 클라이언트에 노출 금지
- MRZ 인식 실패율 약 5~10% — 재촬영 안내 UX 필수
- `formatMRZDate` yy 기준: 30 이하 → 2000년대, 31 이상 → 1900년대로 처리
