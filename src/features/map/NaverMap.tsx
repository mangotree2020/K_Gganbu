// Naver 지도 — react-native-webview + Naver Maps JS API v3 (PLANNING §17)
// Expo 공식 Naver 네이티브 SDK가 없어 WebView로 렌더링한다.
// 마커 탭은 postMessage로 RN에 전달, 중심 이동은 injectJavaScript로 갱신한다.
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

export type NaverMarker = {
  id: string
  lat: number
  lng: number
  color: string
  label?: string
}

type Props = {
  latitude: number
  longitude: number
  markers: NaverMarker[]
  selectedId?: string
  onMarkerPress?: (id: string) => void
  onAuthError?: (msg: string) => void
}

export type NaverMapHandle = {
  moveTo: (lat: number, lng: number, zoom?: number) => void
}

const CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_MAPS_CLIENT_ID ?? ''

// legacy=false: 신형 NCP Maps(oapi + ncpKeyId), legacy=true: 구형(openapi + ncpClientId)
function buildHtml(lat: number, lng: number, markers: NaverMarker[], legacy: boolean) {
  const src = legacy
    ? `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${CLIENT_ID}`
    : `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${CLIENT_ID}`
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
    window.navermap_authFailure = function(){ post({type:'auth_error', message:'Naver 인증 실패 (ncpKeyId/도메인 등록 확인)'}); };
  </script>
  <script src="${src}" onerror="post({type:'auth_error',message:'Naver 지도 스크립트 로드 실패'})"></script>
  <script>
    var map, markers = [];
    function init(){
      if(!window.naver || !naver.maps){ post({type:'auth_error',message:'naver.maps 미로딩'}); return; }
      map = new naver.maps.Map('map', {
        center: new naver.maps.LatLng(${lat}, ${lng}),
        zoom: 13,
        logoControl: true,
        mapDataControl: false,
        scaleControl: false,
      });
      post({type:'ready'});
      setMarkers(${JSON.stringify(markers)});
    }
    function clearMarkers(){ markers.forEach(function(m){ m.setMap(null); }); markers = []; }
    function setMarkers(list){
      clearMarkers();
      list.forEach(function(p){
        var mk = new naver.maps.Marker({
          position: new naver.maps.LatLng(p.lat, p.lng),
          map: map,
          icon: {
            content: '<div style="width:22px;height:22px;border-radius:50%;background:'+p.color+';border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
            anchor: new naver.maps.Point(11, 11),
          },
        });
        naver.maps.Event.addListener(mk, 'click', function(){ post({type:'marker', id:p.id}); });
        markers.push(mk);
      });
    }
    function moveTo(lat, lng, zoom){
      if(!map) return;
      map.morph(new naver.maps.LatLng(lat, lng), zoom || map.getZoom());
    }
    if(document.readyState === 'complete') init();
    else window.addEventListener('load', init);
  </script>
</body>
</html>`
}

export const NaverMap = forwardRef<NaverMapHandle, Props>(function NaverMap(
  { latitude, longitude, markers, onMarkerPress, onAuthError },
  ref,
) {
  const webRef = useRef<WebView>(null)
  // 신형 인증 실패 시 구형 형식으로 1회 자동 폴백
  const [legacy, setLegacy] = useState(false)
  const html = useMemo(
    () => buildHtml(latitude, longitude, markers, legacy),
    // 마커/형식 변경 시에만 재생성 (좌표 변경은 moveTo로 처리)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markers, legacy],
  )

  useImperativeHandle(ref, () => ({
    moveTo: (lat, lng, zoom) => {
      webRef.current?.injectJavaScript(`moveTo(${lat}, ${lng}, ${zoom ?? 'undefined'}); true;`)
    },
  }))

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data)
      if (msg.type === 'marker' && msg.id) onMarkerPress?.(msg.id)
      else if (msg.type === 'auth_error') {
        if (!legacy) {
          // 신형 실패 → 구형 형식으로 재시도
          setLegacy(true)
        } else {
          onAuthError?.(msg.message ?? 'Naver auth error')
        }
      }
    } catch {
      // ignore
    }
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        key={legacy ? 'legacy' : 'new'}
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
