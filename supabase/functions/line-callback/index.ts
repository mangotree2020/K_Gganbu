// line-callback — LINE 로그인 https 중계. LINE은 redirect_uri로 커스텀 스킴(travel-app://)을
// 허용하지 않고 https만 받으므로, https 콜백을 여기서 받아 앱 스킴으로 302 바운스한다.
// LINE 채널 Callback URL엔 이 함수의 https URL을 등록한다. verify_jwt=false(로그인 전 브라우저 호출).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// 앱 스킴 착지점(openAuthSessionAsync가 이 스킴을 가로채 세션 종료)
const APP_RETURN = 'travel-app://auth-callback'

Deno.serve((req) => {
  const url = new URL(req.url)
  // LINE가 붙인 code/state/error 등 쿼리를 그대로 앱 스킴으로 전달
  const target = `${APP_RETURN}${url.search}`
  // 커스텀 스킴으로 302 → Custom Tab이 앱으로 넘김. JS/링크 폴백도 함께 제공.
  const esc = target.replace(/"/g, '&quot;')
  const html =
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
    `<title>LINE</title><script>location.replace("${esc}")</script>` +
    `<p style="font-family:sans-serif;text-align:center;margin-top:40px">` +
    `Redirecting… <a href="${esc}">Open app</a></p>`
  return new Response(html, {
    status: 302,
    headers: { Location: target, 'Content-Type': 'text/html; charset=utf-8' },
  })
})
