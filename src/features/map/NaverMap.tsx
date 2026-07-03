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
    // 내 위치 표시 — 파란 점 마커 갱신 + 해당 위치로 이동
    var myLoc = null;
    function setMyLocation(lat, lng, zoom){
      if(!map) return;
      if(myLoc) myLoc.setMap(null);
      myLoc = new naver.maps.Marker({
        position: new naver.maps.LatLng(lat, lng), map: map, zIndex: 1000,
        icon: { content: '<div style="width:18px;height:18px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,.3),0 1px 4px rgba(0,0,0,.4)"></div>', anchor: new naver.maps.Point(9, 9) },
      });
      map.morph(new naver.maps.LatLng(lat, lng), zoom || 16);
    }
    function clearMarkers(){ markers.forEach(function(m){ m.setMap(null); }); markers = []; }
    function setMarkers(list){
      clearMarkers();
      list.forEach(function(p){
        var mk = new naver.maps.Marker({
          position: new naver.maps.LatLng(p.lat, p.lng),
          map: map,
          icon: {
            content: '<div style="width:22px;height:22px;border-radius:50%;background:'+p.color+';border:3px solid '+(p.outline||'#fff')+';box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
            anchor: new naver.maps.Point(11, 11),
          },
        });
        naver.maps.Event.addListener(mk, 'click', function(){ post({type:'marker', id:p.id}); });
        markers.push(mk);
      });
    }
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
