// admin-web — 파트너 Admin 웹 경량판 (PRD REQ-ADM-1·2·3, BM§5 S-1)
// 단일 HTML SPA를 서빙한다(별도 호스팅 불필요). 페이지 자체는 공개이지만
// 모든 API 호출은 ADMIN_API_KEY(x-admin-key) 입력 없이는 동작하지 않는다.
// 기능: 파트너 선택/등록 · 쿠폰 등록/목록 · QR 검증(카메라+수동) · 사용 통계.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>K-Gganbu Partner Admin</title>
<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
<style>
  :root { --blue:#0EA5E9; --coral:#F97316; --ok:#16A34A; --bad:#DC2626; --zinc:#3F3F46; }
  * { box-sizing:border-box; font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
  body { margin:0; background:#F4F4F5; color:var(--zinc); }
  header { background:linear-gradient(135deg,#0EA5E9,#0284C7); color:#fff; padding:14px 16px; }
  header h1 { margin:0; font-size:17px; } header p { margin:2px 0 0; font-size:12px; opacity:.85; }
  main { max-width:560px; margin:0 auto; padding:12px 12px 40px; }
  .card { background:#fff; border-radius:14px; padding:14px; margin-bottom:12px; box-shadow:0 1px 4px rgba(0,0,0,.06); }
  .card h2 { margin:0 0 10px; font-size:14px; }
  label { display:block; font-size:12px; font-weight:700; margin:8px 0 4px; }
  input, select { width:100%; padding:10px; border:1px solid #E4E4E7; border-radius:10px; font-size:14px; }
  button { width:100%; padding:12px; border:0; border-radius:10px; background:var(--blue); color:#fff; font-size:14px; font-weight:800; margin-top:10px; }
  button.secondary { background:#fff; color:var(--zinc); border:1px solid #E4E4E7; }
  button:disabled { opacity:.5; }
  .row { display:flex; gap:8px; } .row > * { flex:1; }
  .tabs { display:flex; gap:6px; margin-bottom:12px; }
  .tabs button { margin:0; padding:9px 0; font-size:13px; background:#fff; color:var(--zinc); border:1px solid #E4E4E7; }
  .tabs button.on { background:var(--zinc); color:#fff; border-color:var(--zinc); }
  .item { display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px solid #F4F4F5; font-size:13px; }
  .pill { font-size:11px; font-weight:800; padding:2px 8px; border-radius:999px; background:#EFF6FF; color:var(--blue); }
  .big { font-size:26px; font-weight:800; text-align:center; padding:16px 0; border-radius:12px; }
  .ok { background:#F0FDF4; color:var(--ok); } .bad { background:#FEF2F2; color:var(--bad); }
  .muted { color:#A1A1AA; font-size:12px; }
  #reader { border-radius:12px; overflow:hidden; }
</style>
</head>
<body>
<header><h1>K-Gganbu Partner Admin</h1><p>쿠폰 등록 · QR 검증 · 사용 통계</p></header>
<main>
  <!-- 접속 키 + 파트너 선택 -->
  <div class="card" id="authCard">
    <h2>접속</h2>
    <label>Admin Key</label>
    <input id="key" type="password" placeholder="운영팀에서 발급한 키" />
    <label>파트너</label>
    <div class="row">
      <select id="partner"><option value="">키 입력 후 불러오기</option></select>
      <button class="secondary" style="flex:0 0 90px" onclick="loadPartners()">불러오기</button>
    </div>
    <details style="margin-top:8px">
      <summary class="muted">신규 파트너 등록</summary>
      <label>상호명</label><input id="pName" placeholder="예: 해운대 할매국밥" />
      <label>연락처</label><input id="pContact" placeholder="예: 051-000-0000" />
      <button class="secondary" onclick="createPartner()">파트너 등록</button>
    </details>
  </div>

  <div class="tabs">
    <button id="tab-coupons" class="on" onclick="showTab('coupons')">쿠폰</button>
    <button id="tab-verify" onclick="showTab('verify')">QR 검증</button>
    <button id="tab-stats" onclick="showTab('stats')">통계</button>
  </div>

  <!-- 쿠폰 등록/목록 -->
  <section id="sec-coupons">
    <div class="card">
      <h2>쿠폰 등록</h2>
      <label>쿠폰명 (한국어)</label><input id="cKo" placeholder="예: 평일 10% 할인" />
      <label>쿠폰명 (영어)</label><input id="cEn" placeholder="e.g. 10% OFF weekdays" />
      <div class="row">
        <div><label>할인 유형</label>
          <select id="cType"><option value="percentage">% 할인</option><option value="fixed">정액 할인(원)</option><option value="freebie">증정</option></select></div>
        <div><label>할인 값</label><input id="cValue" type="number" placeholder="10" /></div>
      </div>
      <div class="row">
        <div><label>카테고리</label>
          <select id="cCat"><option value="food">음식</option><option value="cafe">카페</option><option value="beauty">뷰티</option><option value="activity">액티비티</option></select></div>
        <div><label>유효기간(까지)</label><input id="cUntil" type="date" /></div>
      </div>
      <button onclick="registerCoupon()">등록</button>
    </div>
    <div class="card"><h2>내 쿠폰</h2><div id="couponList" class="muted">파트너 선택 후 표시됩니다</div></div>
  </section>

  <!-- QR 검증 -->
  <section id="sec-verify" style="display:none">
    <div class="card">
      <h2>QR 검증 (손님 QR을 스캔)</h2>
      <div id="reader"></div>
      <button class="secondary" id="camBtn" onclick="toggleCam()">카메라 시작</button>
      <label>또는 코드 직접 입력</label>
      <div class="row">
        <input id="manualToken" placeholder="QR 토큰" />
        <button style="flex:0 0 90px" onclick="redeem(document.getElementById('manualToken').value)">검증</button>
      </div>
      <div id="verifyResult"></div>
    </div>
  </section>

  <!-- 통계 -->
  <section id="sec-stats" style="display:none">
    <div class="card"><h2>쿠폰별 발급/사용</h2><div id="statsList" class="muted">파트너 선택 후 표시됩니다</div></div>
    <div class="card"><h2>최근 사용</h2><div id="recentList" class="muted">-</div></div>
  </section>
</main>
<script>
const ANON_KEY = '__ANON_KEY__';
const BASE = location.href.replace(/\\/admin-web.*$/, '');
const $ = (id) => document.getElementById(id);
$('key').value = localStorage.getItem('kgb_admin_key') || '';

async function api(fn, body) {
  const key = $('key').value.trim();
  if (!key) { alert('Admin Key를 입력하세요'); throw new Error('no key'); }
  localStorage.setItem('kgb_admin_key', key);
  const res = await fetch(BASE + '/' + fn, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key,
      'Authorization': 'Bearer ' + ANON_KEY, 'apikey': ANON_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.reason || data.error || data.message || res.status);
  return data;
}

function showTab(t) {
  ['coupons','verify','stats'].forEach((x) => {
    $('sec-' + x).style.display = x === t ? '' : 'none';
    $('tab-' + x).classList.toggle('on', x === t);
  });
  if (t === 'stats') loadStats();
  if (t === 'coupons') loadCoupons();
}

async function loadPartners() {
  try {
    const { partners } = await api('partner-coupon', { action: 'partners' });
    const sel = $('partner');
    sel.innerHTML = partners.length ? '' : '<option value="">등록된 파트너 없음</option>';
    partners.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.name + (p.status !== 'active' ? ' (비활성)' : '');
      sel.appendChild(o);
    });
    if (partners.length) loadCoupons();
  } catch (e) { alert('불러오기 실패: ' + e.message); }
}

async function createPartner() {
  try {
    await api('partner-coupon', { action: 'partner_create', name: $('pName').value.trim(), contact: $('pContact').value.trim() });
    alert('파트너 등록 완료'); loadPartners();
  } catch (e) { alert('등록 실패: ' + e.message); }
}

async function registerCoupon() {
  const pid = $('partner').value;
  if (!pid) return alert('파트너를 선택하세요');
  const ko = $('cKo').value.trim(), en = $('cEn').value.trim();
  if (!ko && !en) return alert('쿠폰명을 입력하세요');
  try {
    await api('partner-coupon', {
      action: 'register', partner_id: pid,
      title_i18n: Object.fromEntries([['ko', ko], ['en', en]].filter(([, v]) => v)),
      discount_type: $('cType').value,
      discount_value: $('cValue').value ? Number($('cValue').value) : null,
      category: $('cCat').value,
      valid_until: $('cUntil').value || null,
    });
    alert('쿠폰 등록 완료 — 앱 CouTix에 노출됩니다'); loadCoupons();
  } catch (e) { alert('등록 실패: ' + e.message); }
}

async function loadCoupons() {
  const pid = $('partner').value; if (!pid) return;
  try {
    const { coupons } = await api('partner-coupon', { action: 'list', partner_id: pid });
    $('couponList').innerHTML = coupons.length ? coupons.map((c) =>
      '<div class="item"><span>' + (c.title_i18n?.ko || c.title_i18n?.en || c.id) + '</span><span class="pill">' + c.status + '</span></div>'
    ).join('') : '등록된 쿠폰이 없습니다';
  } catch (e) { $('couponList').textContent = '조회 실패: ' + e.message; }
}

async function loadStats() {
  const pid = $('partner').value; if (!pid) return;
  try {
    const { stats, recent } = await api('partner-coupon', { action: 'stats', partner_id: pid });
    $('statsList').innerHTML = stats.length ? stats.map((s) =>
      '<div class="item"><span>' + s.title + '</span><span>발급 ' + s.issued + ' · <b style="color:var(--ok)">사용 ' + s.used + '</b></span></div>'
    ).join('') : '데이터 없음';
    $('recentList').innerHTML = recent.length ? recent.map((r) =>
      '<div class="item"><span>' + new Date(r.used_at).toLocaleString('ko-KR') + '</span></div>'
    ).join('') : '최근 사용 내역 없음';
  } catch (e) { $('statsList').textContent = '조회 실패: ' + e.message; }
}

// ── QR 검증: 손님 QR 스캔 → coupon(redeem) 즉시 소멸 ──
let scanner = null;
async function toggleCam() {
  if (scanner) { await scanner.stop().catch(() => {}); scanner = null; $('camBtn').textContent = '카메라 시작'; return; }
  scanner = new Html5Qrcode('reader');
  $('camBtn').textContent = '카메라 정지';
  scanner.start({ facingMode: 'environment' }, { fps: 8, qrbox: 220 },
    (text) => { scanner.pause(true); redeem(text).finally(() => setTimeout(() => scanner && scanner.resume(), 1800)); });
}
async function redeem(token) {
  token = (token || '').trim(); if (!token) return;
  const box = $('verifyResult');
  try {
    const r = await api('coupon', { action: 'redeem', qr_token: token, used_location: 'admin-web' });
    box.innerHTML = r.valid
      ? '<div class="big ok">사용 처리 완료</div>'
      : '<div class="big bad">무효: ' + (r.reason || '알 수 없음') + '</div>';
  } catch (e) { box.innerHTML = '<div class="big bad">실패: ' + e.message + '</div>'; }
}
</script>
</body>
</html>`

Deno.serve(() => {
  return new Response(HTML.replace('__ANON_KEY__', ANON), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
})
