// Naver 지도 — react-native-webview + Naver Maps JS API v3 (PLANNING §17)
// Expo 공식 Naver 네이티브 SDK가 없어 WebView로 렌더링한다.
// 마커 탭은 postMessage로 RN에 전달, 중심 이동은 injectJavaScript로 갱신한다.
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

export type NaverMarker = {
  id: string
  lat: number
  lng: number
  color: string
  label?: string
  outline?: string // 마커 테두리색 — Blend 동시 표시 시 소스 구분용(기본 흰색)
  glyph?: string // 카테고리 아이콘(이모지) — 검색 필터와 동일한 성격 구분
}

type Props = {
  latitude: number
  longitude: number
  markers: NaverMarker[]
  selectedId?: string
  onMarkerPress?: (id: string) => void
  // 지도 탭(마커 외) — Naver JS API는 베이스맵 POI 클릭 이벤트가 없어 좌표만 전달,
  // RN이 place-lookup(최근접 시설)으로 장소 정보를 해석한다
  onMapPress?: (q: { lat: number; lng: number }) => void
  onAuthError?: (msg: string) => void
  onReady?: () => void // 지도 init 완료 시(내 위치 마커 초기 표시용)
  onViewChange?: (v: { lat: number; lng: number; zoom: number }) => void // 이동/줌 종료(idle) 시
  language?: string // 앱 설정 언어 (AppLang). 지도 라벨 언어로 사용
}

export type MapType = 'normal' | 'satellite' | 'hybrid'

export type NaverMapHandle = {
  moveTo: (lat: number, lng: number, zoom?: number) => void
  drawRoute: (path: { latitude: number; longitude: number }[]) => void
  clearRoute: () => void
  setMapType: (type: MapType) => void
  setMyLocation: (lat: number, lng: number, zoom?: number) => void
  setHeading: (deg: number) => void // 내 방향(나침반) — 위치 핀의 방향 빔 회전
  // Blend 레이어 투명도 — RN View opacity는 Android WebView에서 무시되므로
  // WebView 내부 CSS(#map opacity)로 제어한다
  setOpacity: (v: number) => void
}

const CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_MAPS_CLIENT_ID ?? ''

// 앱 설정 언어(AppLang) → Naver Maps 지원 언어. Naver는 ko/en/ja/zh만 지원하므로
// 중문 간체/번체는 모두 zh로 통합한다.
type NaverLang = 'ko' | 'en' | 'ja' | 'zh'
const NAVER_LANG: Record<string, NaverLang> = {
  ko: 'ko',
  en: 'en',
  ja: 'ja',
  'zh-CN': 'zh',
  'zh-TW': 'zh',
}
const toNaverLang = (lang?: string): NaverLang => NAVER_LANG[lang ?? ''] ?? 'en'

// 신형 NCP Maps(oapi + ncpKeyId)만 사용. 구형(openapi + ncpClientId)은 2026-06-25 종료로 제거.
function buildHtml(lat: number, lng: number, markers: NaverMarker[], lang: NaverLang) {
  const src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${CLIENT_ID}&language=${lang}`
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>html,body{margin:0;padding:0;width:100%;height:100%;background:transparent;}#map{margin:0;padding:0;width:100%;height:100%;}</style>
</head>
<body>
  <div id="map"></div>
  <script>
    function post(obj){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj)); }
    window.navermap_authFailure = function(){ post({type:'auth_error', message:'Naver 인증 실패 — Console에서 ' + location.origin + ' 등록/서비스 활성/전파(최대 30분) 확인'}); };
  </script>
  <script src="${src}" onerror="post({type:'auth_error',message:'Naver 지도 스크립트 로드 실패'})"></script>
  <script>
    var map, markers = [];
    function init(){
      if(!window.naver || !naver.maps){ post({type:'auth_error',message:'naver.maps 미로딩'}); return; }
      map = new naver.maps.Map('map', {
        center: new naver.maps.LatLng(${lat}, ${lng}),
        zoom: 16, // 도보 이동 기준 측척(거리 단위)
        logoControl: true,
        mapDataControl: false,
        scaleControl: true, // 측척 바 표시
      });
      post({type:'ready'});
      setMarkers(${JSON.stringify(markers)});
      // 이동/줌 종료 시 현재 뷰 통지 — RN이 다른 지도와 중심·축척을 동기화(Blend 정합)
      naver.maps.Event.addListener(map, 'idle', function(){
        var c = map.getCenter();
        post({type:'view', lat: c.lat(), lng: c.lng(), zoom: map.getZoom()});
      });
      // 줌 변경 시 클러스터 재계산(묶기/풀기)
      naver.maps.Event.addListener(map, 'zoom_changed', function(){ setTimeout(renderMarkers, 80); });
      // 지도 탭 좌표 통지 — RN이 최근접 장소를 해석해 정보 시트 표시(POI 아이콘 탭 대용)
      naver.maps.Event.addListener(map, 'click', function(e){
        post({type:'mapclick', lat: e.coord.lat(), lng: e.coord.lng()});
      });
    }
    // 지도 유형 전환 (일반/위성/하이브리드)
    function setMapType(type){
      if(!map || !naver.maps.MapTypeId) return;
      var m = { normal: naver.maps.MapTypeId.NORMAL, satellite: naver.maps.MapTypeId.SATELLITE, hybrid: naver.maps.MapTypeId.HYBRID };
      map.setMapTypeId(m[type] || naver.maps.MapTypeId.NORMAL);
    }
    // 내 위치 표시 — GoogleMap과 완전히 동일한 SVG 지오메트리(같은 핀·빔 경로, 핀 끝 축 회전)로
    // 방향 표기가 두 지도에서 정확히 일치하도록 한다.
    // 방향 빔: 연한 그라데이션 콘(가까울수록 진하고 멀수록 투명).
    // 핀 머리 아이콘: 하단 네비게이션 바 AI 깐부와 동일한 lucide Bot 글리프(일관성).
    var myLoc = null, myHeading = 0;
    function myLocContent(){
      return '<svg width="88" height="124" viewBox="-44 -87 88 124" style="overflow:visible;display:block">'
        + '<defs><linearGradient id="kgbBeam" x1="0" y1="0" x2="0" y2="-38" gradientUnits="userSpaceOnUse">'
        + '<stop offset="0" stop-color="#3B82F6" stop-opacity="0.45"/>'
        + '<stop offset="1" stop-color="#3B82F6" stop-opacity="0"/>'
        + '</linearGradient></defs>'
        + '<path d="M 0 0 L -13 -34 Q 0 -41 13 -34 Z" fill="url(#kgbBeam)" transform="rotate('+myHeading+')"/>'
        + '<path d="M 0 0 C -2 -8 -11 -11 -11 -20 A 11 11 0 1 1 11 -20 C 11 -11 2 -8 0 0 Z" fill="#2563EB" stroke="#ffffff" stroke-width="2.5"/>'
        + '<g transform="translate(-6,-26) scale(0.5)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>'
        + '</g>'
        + '</svg>';
    }
    function myLocIcon(){
      // viewBox 좌표 (0,0)=핀 끝. 앵커 = SVG 내 (44, 87) 픽셀 지점
      return { content: myLocContent(), anchor: new naver.maps.Point(44, 87) };
    }
    function setMyLocation(lat, lng, zoom){
      if(!map) return;
      if(myLoc) myLoc.setMap(null);
      myLoc = new naver.maps.Marker({
        position: new naver.maps.LatLng(lat, lng), map: map, zIndex: 1000,
        icon: myLocIcon(),
      });
      map.morph(new naver.maps.LatLng(lat, lng), zoom || 16);
    }
    function setHeading(deg){
      myHeading = deg;
      if(myLoc) myLoc.setIcon(myLocIcon());
    }
    function clearMarkers(){ markers.forEach(function(m){ m.setMap(null); }); markers = []; }
    // 마커 클러스터링 — 줌이 낮으면 지역별로 묶어 숫자 배지로 표시(가독성),
    // 클러스터 탭 시 해당 지역으로 확대, 줌 15+에서는 개별 마커 표시.
    var markerData = [];
    var CLUSTER_MAX_ZOOM = 14;
    function renderMarkers(){
      clearMarkers();
      if(!map) return;
      var zoom = map.getZoom();
      if(zoom > CLUSTER_MAX_ZOOM){
        markerData.forEach(function(p){
          var mk = new naver.maps.Marker({
            position: new naver.maps.LatLng(p.lat, p.lng),
            map: map,
            icon: {
              content: '<div style="width:26px;height:26px;border-radius:50%;background:'+p.color+';border:3px solid '+(p.outline||'#fff')+';box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1">'+(p.glyph||'')+'</div>',
              anchor: new naver.maps.Point(13, 13),
            },
          });
          naver.maps.Event.addListener(mk, 'click', function(){ post({type:'marker', id:p.id}); });
          markers.push(mk);
        });
        return;
      }
      // 격자 클러스터 — 줌에 비례한 셀 크기(도 단위)로 그룹핑
      var cell = 360 / Math.pow(2, zoom) / 3;
      var groups = {};
      markerData.forEach(function(p){
        var key = Math.floor(p.lat / cell) + ':' + Math.floor(p.lng / cell);
        (groups[key] = groups[key] || []).push(p);
      });
      Object.keys(groups).forEach(function(key){
        var g = groups[key];
        var lat = g.reduce(function(s,p){ return s+p.lat; },0)/g.length;
        var lng = g.reduce(function(s,p){ return s+p.lng; },0)/g.length;
        if(g.length === 1){
          var p = g[0];
          var mk = new naver.maps.Marker({
            position: new naver.maps.LatLng(p.lat, p.lng), map: map,
            icon: {
              content: '<div style="width:26px;height:26px;border-radius:50%;background:'+p.color+';border:3px solid '+(p.outline||'#fff')+';box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1">'+(p.glyph||'')+'</div>',
              anchor: new naver.maps.Point(13, 13),
            },
          });
          naver.maps.Event.addListener(mk, 'click', function(){ post({type:'marker', id:p.id}); });
          markers.push(mk);
        } else {
          var size = g.length >= 10 ? 44 : 36;
          var cl = new naver.maps.Marker({
            position: new naver.maps.LatLng(lat, lng), map: map, zIndex: 500,
            icon: {
              content: '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:#0EA5E9;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;font-family:sans-serif">'+g.length+'</div>',
              anchor: new naver.maps.Point(size/2, size/2),
            },
          });
          naver.maps.Event.addListener(cl, 'click', function(){
            // 클러스터 탭 → 해당 지역 확대(개별 마커가 보일 때까지 단계 확대)
            map.morph(new naver.maps.LatLng(lat, lng), Math.min(zoom + 2, CLUSTER_MAX_ZOOM + 1));
          });
          markers.push(cl);
        }
      });
    }
    function setMarkers(list){ markerData = list; renderMarkers(); }
    // Blend 레이어 투명도 — 지도 전체(#map)에 CSS opacity 적용
    function setLayerOpacity(v){ var el=document.getElementById('map'); if(el) el.style.opacity=v; }
    function moveTo(lat, lng, zoom){
      if(!map) return;
      map.morph(new naver.maps.LatLng(lat, lng), zoom || map.getZoom());
    }
    var routeLine = null;
    function drawRoute(coords){
      clearRoute();
      if(!map || !coords || !coords.length) return;
      var pts = coords.map(function(c){ return new naver.maps.LatLng(c.latitude, c.longitude); });
      routeLine = new naver.maps.Polyline({
        map: map, path: pts, strokeColor: '#0EA5E9', strokeWeight: 6, strokeOpacity: 0.9,
      });
      // 경로 전체가 보이도록 영역 맞춤
      var bounds = new naver.maps.LatLngBounds(pts[0], pts[0]);
      pts.forEach(function(p){ bounds.extend(p); });
      map.fitBounds(bounds, { top: 60, right: 40, bottom: 220, left: 40 });
    }
    function clearRoute(){ if(routeLine){ routeLine.setMap(null); routeLine = null; } }
    if(document.readyState === 'complete') init();
    else window.addEventListener('load', init);
  </script>
</body>
</html>`
}

export const NaverMap = forwardRef<NaverMapHandle, Props>(function NaverMap(
  {
    latitude,
    longitude,
    markers,
    onMarkerPress,
    onMapPress,
    onAuthError,
    onReady,
    onViewChange,
    language,
  },
  ref,
) {
  const webRef = useRef<WebView>(null)
  const naverLang = toNaverLang(language)
  const html = useMemo(
    () => buildHtml(latitude, longitude, markers, naverLang),
    // 마커/언어 변경 시에만 재생성 (좌표 변경은 moveTo로 처리)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markers, naverLang],
  )

  useImperativeHandle(ref, () => ({
    moveTo: (lat, lng, zoom) => {
      webRef.current?.injectJavaScript(`moveTo(${lat}, ${lng}, ${zoom ?? 'undefined'}); true;`)
    },
    drawRoute: (path) => {
      webRef.current?.injectJavaScript(`drawRoute(${JSON.stringify(path)}); true;`)
    },
    clearRoute: () => {
      webRef.current?.injectJavaScript(`clearRoute(); true;`)
    },
    setMapType: (type) => {
      webRef.current?.injectJavaScript(`setMapType(${JSON.stringify(type)}); true;`)
    },
    setMyLocation: (lat, lng, zoom) => {
      webRef.current?.injectJavaScript(
        `setMyLocation(${lat}, ${lng}, ${zoom ?? 'undefined'}); true;`,
      )
    },
    setHeading: (deg) => {
      webRef.current?.injectJavaScript(`setHeading(${deg}); true;`)
    },
    setOpacity: (v) => {
      webRef.current?.injectJavaScript(`setLayerOpacity(${v}); true;`)
    },
  }))

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data)
      if (msg.type === 'marker' && msg.id) onMarkerPress?.(msg.id)
      else if (msg.type === 'mapclick') onMapPress?.({ lat: msg.lat, lng: msg.lng })
      else if (msg.type === 'ready') onReady?.()
      else if (msg.type === 'view') onViewChange?.({ lat: msg.lat, lng: msg.lng, zoom: msg.zoom })
      else if (msg.type === 'auth_error') onAuthError?.(msg.message ?? 'Naver auth error')
    } catch {
      // ignore
    }
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost' }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
      />
    </View>
  )
})
