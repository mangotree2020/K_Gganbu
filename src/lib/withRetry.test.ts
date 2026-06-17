import { withRetry } from '@/lib/withRetry'

describe('withRetry', () => {
  it('첫 시도 성공 시 1회만 호출', async () => {
    let calls = 0
    const r = await withRetry(async () => {
      calls++
      return 'ok'
    })
    expect(r).toBe('ok')
    expect(calls).toBe(1)
  })

  it('실패 후 재시도하여 성공', async () => {
    let calls = 0
    const r = await withRetry(
      async () => {
        calls++
        if (calls < 3) throw new Error('fail')
        return 'recovered'
      },
      { retries: 3, baseDelayMs: 1 },
    )
    expect(r).toBe('recovered')
    expect(calls).toBe(3)
  })

  it('재시도 소진 시 마지막 에러 throw', async () => {
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls++
          throw new Error('always')
        },
        { retries: 2, baseDelayMs: 1 },
      ),
    ).rejects.toThrow('always')
    expect(calls).toBe(3) // 최초 1 + 재시도 2
  })
})
