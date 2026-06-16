// 동적 Expo 설정 — app.json을 기반으로 Google Maps API 키를 네이티브 설정에 주입한다.
// 키는 .env(EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)에서 읽어 매니페스트에 넣어 git 커밋을 피한다.
module.exports = ({ config }) => {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY

  config.android = config.android || {}
  config.android.config = {
    ...(config.android.config || {}),
    googleMaps: { apiKey: key },
  }

  config.ios = config.ios || {}
  config.ios.config = {
    ...(config.ios.config || {}),
    googleMapsApiKey: key,
  }

  return config
}
