// 즐겨찾기 타입 — 외부 POI(TourAPI/Naver)를 place_ext_id + 표시정보로 비정규화 저장
// (PLANNING §20, BACKLOG #20). 순수 타입만 두어 네이티브/네트워크 의존 없이 재사용한다.

// 즐겨찾기 대상 POI (앱 Poi에서 추출)
export type FavPoi = {
  extId: string
  name: string
  address?: string | null
  lat?: number | null
  lng?: number | null
  imageUrl?: string | null
  cat?: string | null
}

// favorites 테이블 행 (로컬 캐시도 동일 형태로 보관 → 화면 코드는 출처를 몰라도 된다)
export type FavoriteRow = {
  id: string
  place_ext_id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  image_url: string | null
  cat: string | null
  created_at: string
}

// 서버 미반영 작업 — 로컬에 먼저 쓰고 큐에 쌓아 뒤에서 재시도한다(오프라인 저장 지원).
// id: 전송 완료분 식별용. 같은 밀리초에 재토글되면 at만으로는 구분되지 않아 순번을 붙인다.
export type FavOp = {
  id: string
  op: 'add' | 'remove'
  poi: FavPoi
  at: number
}
