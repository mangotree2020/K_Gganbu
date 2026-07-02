// admin-web — (이전됨) 파트너 Admin은 정적 파일 web/admin.html 로 이동.
// Supabase는 함수·Storage 공개 URL의 HTML 응답을 text/plain으로 강제(피싱 방지)해
// 브라우저 렌더가 불가하다 → 외부 정적 호스팅에 배포한다(docs/SETUP_EXTERNAL.md).
// ADMIN_WEB_URL 시크릿이 설정되면 그 주소로 302, 아니면 안내 JSON.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

Deno.serve(() => {
  const dest = Deno.env.get('ADMIN_WEB_URL')
  if (dest) return new Response(null, { status: 302, headers: { Location: dest } })
  return new Response(
    JSON.stringify({
      moved: true,
      message:
        'Partner Admin은 정적 페이지(web/admin.html)로 이전되었습니다. ' +
        '외부 정적 호스팅에 배포 후 ADMIN_WEB_URL 시크릿을 설정하면 이 주소가 리다이렉트됩니다.',
      docs: 'docs/SETUP_EXTERNAL.md — "QR 랜딩·Admin 호스팅"',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
