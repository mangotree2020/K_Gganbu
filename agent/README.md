# K-Gganbu 음성 통역 Agent (Gemini 3.5 Live Translate)

PLANNING §25 아키텍처의 **Agent 워커**. 마이크 오디오를 LiveKit Room에서 받아
Gemini Live Translate로 실시간 통역하고, 번역 음성 + transcript를 Room에 발행한다.

```
앱(마이크) → LiveKit Room(WebRTC) → [이 Agent] → Gemini Live API
        ↑ 번역 음성(24kHz) + transcript ↓
토큰 발급: Supabase Edge Function `livekit-token` (LiveKit + metadata)
```

> ⚠️ 이 워커는 Supabase Edge Function이 **아니다**. 상시 실행되는 별도 프로세스로,
> LiveKit Cloud Agents 또는 자체 서버/컨테이너에 배포해 24/7 돌려야 한다.
> Gemini Live는 preview 단계 → 가용성·요금·쿼터 변동 가능. 텍스트/회화 폴백 필수.

## 사전 준비

1. **LiveKit 프로젝트** (LiveKit Cloud 무료 또는 self-host) → URL/API_KEY/API_SECRET
   - 동일 키를 Supabase 시크릿에도 설정:
     `npx supabase secrets set LIVEKIT_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...`
2. **Gemini API 키** (Google AI Studio / Vertex) — gemini-3.5-live-translate-preview 접근

## 로컬 실행

```bash
cd agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 값 채우기
python agent.py dev    # 개발 모드(자동 재시작)
# 또는 python agent.py start  # 운영
```

## 배포 (택1)

- **LiveKit Cloud Agents**: `lk agent create` / dashboard 업로드 (권장 — 관리형)
- **컨테이너**: Dockerfile로 빌드 후 Fly.io/Render/자체 Linux 서버에 상시 실행
- 환경변수(LIVEKIT\_\*, GEMINI_API_KEY)를 배포 환경 시크릿으로 주입

## 동작

- 참가자 입장 시 토큰 metadata의 `targetLang`/`sourceLang`를 읽어 통역 방향 결정
  (앱 → `livekit-token` Edge Function이 metadata 주입)
- Gemini Live가 speech-to-speech로 번역 음성을 생성해 Room에 발행 → 앱이 수신·재생
- transcript는 LiveKit transcription 이벤트로 앱에 표시(분할 화면)

## 주의 (PLANNING §25 리스크)

- preview: 모델 한계(긴 침묵 후 톤 변동, 비원어민 억양·유사언어 감지 오류, 소음)
- 모든 출력 음성에 SynthID 워터마크 포함
- 실패/끊김 시 앱은 텍스트 번역·상황별 회화로 폴백
