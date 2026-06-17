// 네트워크 재시도 래퍼 (PLANNING §10, §15) — 일시적 오류 시 지수 백오프로 재시도.
// 공항/항만/이동 중 불안정 네트워크 대응. 최종 실패 시 마지막 에러를 throw → 호출부에서 mock 폴백.
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const { retries = 2, baseDelayMs = 400 } = opts
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt))
      }
    }
  }
  throw lastErr
}
