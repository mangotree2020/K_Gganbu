// Google 지도 — react-native-webview + Google Maps JavaScript API (PLANNING §17)
// react-native-maps에는 per-MapView 언어 옵션이 없어, 라벨을 앱 설정 언어로
// 표시하려면 JS API의 &language= 파라미터가 필요하다. NaverMap과 동일하게
// WebView로 렌더링하고 같은 핸들(moveTo/drawRoute/clearRoute)을 노출한다.
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

export type GoogleMarker = {
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
  markers: GoogleMarker[]
  selectedId?: string
  onMarkerPress?: (id: string) => void
  onAuthError?: (msg: string) => void
  onReady?: () => void // 지도 init 완료 시(내 위치 마커 초기 표시용)
  onViewChange?: (v: { lat: number; lng: number; zoom: number }) => void // 이동/줌 종료(idle) 시
  language?: string // 앱 설정 언어 (AppLang). 지도 라벨 언어로 사용
}

export type GoogleMapHandle = {
  moveTo: (lat: number, lng: number, zoom?: number) => void
  drawRoute: (path: { latitude: number; longitude: number }[]) => void
  clearRoute: () => void
  setMapType: (type: 'normal' | 'satellite' | 'hybrid') => void
  setMyLocation: (lat: number, lng: number, zoom?: number) => void
}

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

// Google Maps JS API는 BCP-47 언어코드를 그대로 받는다 (en/ko/ja/zh-CN/zh-TW)
function buildHtml(lat: number, lng: number, markers: GoogleMarker[], lang: string) {
  const src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&language=${lang}&callback=initMap`
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
</head>
<body>
  <div id="map"></div>
  <script>
    function post(obj){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj)); }
    // 인증/요금 오류 시 Google이 호출하는 전역 콜백
    window.gm_authFailure = function(){ post({type:'auth_error', message:'Google Maps 인증 실패 — API 키/Maps JavaScript API 활성/HTTP 리퍼러(' + location.origin + ') 확인'}); };
    var map, markers = [], routeLine = null;
    function initMap(){
      if(!window.google || !google.maps){ post({type:'auth_error',message:'google.maps 미로딩'}); return; }
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: ${lat}, lng: ${lng} },
        zoom: 16, // 도보 이동 기준 측척
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
        scaleControl: true, // 측척 바 표시
      });
      post({type:'ready'});
      setMarkers(${JSON.stringify(markers)});
      // 이동/줌 종료 시 현재 뷰 통지 — RN이 다른 지도와 중심·축척을 동기화(Blend 정합)
      map.addListener('idle', function(){
        var c = map.getCenter();
        post({type:'view', lat: c.lat(), lng: c.lng(), zoom: map.getZoom()});
      });
    }
    window.initMap = initMap;
    // 지도 유형 전환 (일반/위성/하이브리드)
    function setMapType(type){
      if(!map) return;
      var m = { normal: 'roadmap', satellite: 'satellite', hybrid: 'hybrid' };
      map.setMapTypeId(m[type] || 'roadmap');
    }
    // 내 위치 표시 — 파란 점 마커 갱신 + 이동
    var myLoc = null;
    function setMyLocation(lat, lng, zoom){
      if(!map) return;
      if(myLoc) myLoc.setMap(null);
      myLoc = new google.maps.Marker({
        position: { lat: lat, lng: lng }, map: map, zIndex: 1000,
        icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#2563EB', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3, scale: 7 },
      });
      map.panTo({ lat: lat, lng: lng });
      map.setZoom(zoom || 16);
    }
    function clearMarkers(){ markers.forEach(function(m){ m.setMap(null); }); markers = []; }
    function setMarkers(list){
      clearMarkers();
      list.forEach(function(p){
        var mk = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: p.color,
            fillOpacity: 1,
            strokeColor: p.outline || '#ffffff',
            strokeWeight: 3,
            scale: 8,
          },
        });
        mk.addListener('click', function(){ post({type:'marker', id:p.id}); });
        markers.push(mk);
      });
    }
    function moveTo(lat, lng, zoom){
      if(!map) return;
      map.panTo({ lat: lat, lng: lng });
      if(zoom) map.setZoom(zoom);
    }
    function drawRoute(coords){
      clearRoute();
      if(!map || !coords || !coords.length) return;
      var pts = coords.map(function(c){ return { lat: c.latitude, lng: c.longitude }; });
      routeLine = new google.maps.Polyline({
        map: map, path: pts, strokeColor: '#0EA5E9', strokeWeight: 6, strokeOpacity: 0.9,
      });
      // 경로 전체가 보이도록 영역 맞춤
      var bounds = new google.maps.LatLngBounds();
      pts.forEach(function(p){ bounds.extend(p); });
      map.fitBounds(bounds, { top: 60, right: 40, bottom: 220, left: 40 });
    }
    function clearRoute(){ if(routeLine){ routeLine.setMap(null); routeLine = null; } }
  </script>
  <script src="${src}" async onerror="post({type:'auth_error',message:'Google 지도 스크립트 로드 실패'})"></script>
</body>
</html>`
}

export const GoogleMap = forwardRef<GoogleMapHandle, Props>(function GoogleMap(
  { latitude, longitude, markers, onMarkerPress, onAuthError, onReady, onViewChange, language },
  ref,
) {
  const webRef = useRef<WebView>(null)
  const lang = language ?? 'en'
  const html = useMemo(
    () => buildHtml(latitude, longitude, markers, lang),
    // 마커/언어 변경 시에만 재생성 (좌표 변경은 moveTo로 처리)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markers, lang],
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
  }))

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data)
      if (msg.type === 'marker' && msg.id) onMarkerPress?.(msg.id)
      else if (msg.type === 'ready') onReady?.()
      else if (msg.type === 'view') onViewChange?.({ lat: msg.lat, lng: msg.lng, zoom: msg.zoom })
      else if (msg.type === 'auth_error') onAuthError?.(msg.message ?? 'Google auth error')
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
        style={{ flex: 1, backgroundColor: '#E5ECF2' }}
        scrollEnabled={false}
      />
    </View>
  )
})
