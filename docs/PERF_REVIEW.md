# 성능 검증·개선 기록 (Claude · Codex · Gemini 3자 교차)

- 일자: 2026-07-30
- 방법: Claude(자체 정적 분석) + `codex exec --sandbox read-only` + `gemini -p`(read-only 지시)로
  동일 범위(app/·src/ 런타임 성능)를 독립 검토 → 지적을 코드로 재검증해 반영/유보 판정
- 원칙: 지적 무비판 수용 금지(CLAUDE.md 검증 루틴). 판단 갈린 항목은 코드 근거로 판정

## 판정 요약

| #   | 지적                                                                       | 출처                           | 심각도 | 판정                | 근거·조치                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------- | ------------------------------ | ------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 지도 WebView가 마커 변경마다 HTML 재생성 → 전체 리로드(타일 재요청·깜빡임) | Gemini(high) ↔ Codex(문제없음) | high   | **반영**            | Codex는 "마커·언어에만 의존"이라 통상 렌더에선 문제없다고 봤으나, POI 로드·필터 변경 시 `markers` dep으로 리로드되는 것은 사실. `setMarkers()` injectJavaScript 주입으로 전환, ready 전 변경분은 ready 수신 시 일괄 주입 (GoogleMap/NaverMap) |
| 2   | `toB64` 바이트별 문자열 결합 — 통역 중 100ms마다 JS 스레드 점유            | Codex·Gemini(high)             | high   | **반영**            | `String.fromCharCode.apply` 8K 청크 배치로 교체 (geminiLive.ts)                                                                                                                                                                               |
| 3   | 다시듣기 PCM `Map` 무한 누적(UI는 40턴 상한, Map은 정리 없음)              | Codex(high)                    | high   | **반영**            | turns 변경 effect에서 탈락 턴 id의 PCM 즉시 삭제 (voice-interpret.tsx)                                                                                                                                                                        |
| 4   | OCR 촬영 원본(12MP)을 리사이즈 없이 base64 로드 — 순간 수십 MB·OOM 위험    | Codex(high)                    | high   | **반영**            | `expo-image-manipulator` 추가, 장변 1600px 리사이즈 + JPEG 0.7 후 base64 (translate.tsx)                                                                                                                                                      |
| 5   | profile 화면 Zustand 전체 구독                                             | Gemini(med)                    | med    | **반영**            | 셀렉터 구독으로 전환 (profile.tsx 2곳)                                                                                                                                                                                                        |
| 6   | useAuth 전체 구독 + 토큰 갱신마다 동값 새 객체로 루트 리렌더               | Codex(med)                     | med    | **반영**            | 개별 셀렉터 + `setUser` 동등성 bail (useAuth.ts, auth/store.ts)                                                                                                                                                                               |
| 7   | 만보계 Android 폴백이 걸음 콜백마다 MMKV read-modify-write                 | Codex(med)                     | med    | **반영**            | 누적은 로컬 변수, 반영 1초 스로틀 + 해제 시 flush (pedometer.ts)                                                                                                                                                                              |
| 8   | rps 게임 타이머 ID 배열이 라운드마다 누적                                  | Gemini(low)                    | low    | **반영**            | 라운드 시작·언마운트 시 배열 정리 (rps-game.tsx)                                                                                                                                                                                              |
| 9   | AI 채팅: "스트리밍 토큰마다" 이력 전체 MMKV 재저장                         | Codex(high)                    | —      | **유보(전제 오류)** | ai.tsx는 토큰 스트리밍이 아니라 메시지 단위 setMsgs — 저장은 메시지당 1회. 메시지당 30세션 직렬화는 개선 여지 있으나 체감 낮음 → 백로그                                                                                                       |
| 10  | AI 채팅 ScrollView+map() → FlatList 전환                                   | Codex(high)                    | —      | **유보**            | 토큰 스트리밍이 없어 재조정 빈도 낮음. 세션이 매우 길어질 때만 문제 → 백로그                                                                                                                                                                  |
| 11  | 홈 피드 40개 카드 가상화(홈 전체 FlatList 개편)                            | Codex(high)                    | —      | **유보**            | FEED_MAX=40 상한 + `cards` useMemo로 재렌더는 억제돼 있음. 홈 전체 구조 개편은 회귀 위험 큰 대규모 리팩터링 → 백로그                                                                                                                          |
| 12  | coupons/reviews ScrollView+map() 가상화                                    | Codex·Gemini(med)              | —      | **유보**            | 현재 데이터 소량(쿠폰 수 개). 서버 페이지네이션과 함께 갈 사안 → 백로그                                                                                                                                                                       |
| 13  | i18n 전체 사전(≈131KB+)을 시작 시 평가 — 언어별 분할 로딩                  | Codex(med)                     | —      | **유보**            | 27개 언어 확장과 맞물린 구조 개편(사전 추가 작업과 함께 진행이 적절) → 백로그                                                                                                                                                                 |
| 14  | 오디오 PCM 변환·Base64를 네이티브(JSI)로 이동                              | Codex(high)                    | —      | **부분 반영**       | 1차로 JS 청크 최적화(#2)로 대응. 네이티브 이동은 실측(프로파일링) 후 판단 → 백로그                                                                                                                                                            |
| 15  | 앱 시작 시간·이미지 캐싱                                                   | Gemini(이상 없음)              | —      | **일치**            | `_layout.tsx` 비동기 초기화·CachedImage(memory-disk) 일관 사용 — 3자 모두 문제없음 판정                                                                                                                                                       |

## 모델 간 판단이 갈린 항목

- **#1 지도 리로딩**: Gemini high ↔ Codex 문제없음. 코드 재검증 결과 Gemini가 옳음
  (html useMemo deps에 `markers`가 있어 마커 변경 = source 교체 = 전체 리로드).
  단 Codex 지적대로 GPS 갱신·통상 렌더에서는 리로드가 없던 것도 사실 — 두 판단 모두 부분 정답.
- **#9 AI 채팅 저장**: Codex가 "스트리밍 토큰마다"로 전제했으나 실제는 메시지 단위 → 심각도 하향.

## 2차(회귀) 교차 검증 — Codex, 수정 diff 대상

high 회귀 없음. med 2건·low 2건 반영, 나머지 low는 유보.

| 지적                                                                            | 심각도 | 판정 | 조치                                                                 |
| ------------------------------------------------------------------------------- | ------ | ---- | -------------------------------------------------------------------- |
| WebView 재로드(언어 변경) 시 `readyRef` 미리셋 → 초기화 전 주입 가능            | med    | 반영 | `onLoadStart`에서 ready 리셋 (양쪽 지도)                             |
| 만보계 자정 경계 — 구독 시작 날짜에 키 고정(기존 결함, 스로틀이 오차 ~1초 추가) | med    | 반영 | 콜백·flush마다 `dayKey` 재판정, 날짜 전환 시 전날 저장 후 새 키 전환 |
| OCR: picker 치수 0/undefined면 리사이즈 미적용 → 대용량 원본 통과               | low    | 반영 | 치수 미상도 리사이즈 적용(업스케일 감수, OOM 방지 우선)              |
| PCM 정리 조건(`size > turns.length`) 불완전                                     | low    | 반영 | 조건 제거, turns 변경마다 정리(≤40개 Set, 비용 무시 수준)            |
| 마커 수천 개 시 injectJavaScript 직렬화 비용                                    | low    | 유보 | 현 POI 규모(수십 개)에선 비해당. diff 적용은 규모 커질 때            |
| `setUser` JSON.stringify 대신 명시적 필드 비교                                  | low    | 유보 | AuthUser는 평면 객체·필드 고정, 현 구조에서 정확. 필드 추가 시 재고  |
| 초기 로드 시 setMarkers 2회 실행(HTML 내장 + ready 주입)                        | low    | 유보 | 초기 1회 중복 생성 비용뿐, 기능 무해                                 |

## 실기기 확인 (SM-S931N, 릴리스 빌드)

- 지도 탭: 새 마커 주입 경로로 POI·카테고리 글리프 마커 정상 렌더, JS 오류 0건
- 언어 설정(ja) 강제종료 후 유지 확인 — locale-storage 영속 정상
- expo-image-manipulator 네이티브 모듈 APK 포함 확인(dex 클래스 존재)
- 특이: 배포 직후 1회 앱 언어가 en으로 바뀌어 있던 사례(원인 미상, 재현 불가 —
  ja 재설정·재시작으로 유지 확인됨). 재발 시 locale-storage 재수화 로깅 추가할 것

## 남은 검증

- [ ] 실기기 프로파일링(Perf Monitor)으로 #2·#7 개선 실측 — 통역 10분 연속·도보 이동 시나리오
- [ ] 지도 클러스터 축소/확대·마커 탭→시트 연결·경로 그리기 수동 회귀 확인
- [ ] OCR 카메라 촬영 → 리사이즈 경로 실사용 확인(대형 원본 사진)
