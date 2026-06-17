// 앱 런타임 설정 플래그
// EXPO_PUBLIC_USE_MOCK=true 면 외부 API를 건너뛰고 mock 구현을 사용한다 (오프라인 데모/테스트).
export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true'
