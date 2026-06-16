"""
K-Gganbu 음성 통역 Agent (PLANNING §25)

마이크 오디오를 LiveKit Room에서 받아 Gemini 3.5 Live Translate로 실시간
speech↔speech 통역한 뒤, 번역 음성 + transcript를 Room에 다시 발행한다.

- 모델: gemini-3.5-live-translate-preview (Gemini Live API, preview)
- 입력 16kHz PCM / 출력 24kHz audio
- 통역 방향(sourceLang/targetLang)은 참가자 토큰 metadata에서 읽음
  (livekit-token Edge Function이 metadata로 주입)

⚠️ 이 워커는 Supabase Edge Function이 아니라 **상시 실행되는 별도 프로세스**다.
   배포/실행은 agent/README.md 참고. preview 단계이므로 가용성·쿼터 변동 주의.
"""

import json
import logging
import os

from livekit import agents
from livekit.agents import Agent, AgentSession, JobContext
from livekit.plugins import google

logger = logging.getLogger("kgganbu-interpreter")

DEFAULT_TARGET = "ko"


async def entrypoint(ctx: JobContext):
    await ctx.connect()

    # 첫 참가자의 토큰 metadata에서 통역 방향 파싱
    target_lang = DEFAULT_TARGET
    source_lang = "auto"
    participant = await ctx.wait_for_participant()
    try:
        meta = json.loads(participant.metadata or "{}")
        target_lang = meta.get("targetLang", DEFAULT_TARGET)
        source_lang = meta.get("sourceLang", "auto")
    except Exception:  # noqa: BLE001
        logger.warning("metadata 파싱 실패 — 기본값 사용")

    logger.info("통역 시작: %s → %s", source_lang, target_lang)

    # Gemini Live Translate 세션 (speech-to-speech)
    # NOTE: 모델/플러그인 파라미터는 livekit-plugins-google 버전에 맞춰 조정.
    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-3.5-live-translate-preview",
            # 화자 톤·pitch 유지, 70+ 언어 자동 감지 (§25)
            modalities=["AUDIO", "TEXT"],
            # targetLanguageCode: 번역 대상 언어
            language=target_lang,
            api_key=os.environ["GEMINI_API_KEY"],
        ),
    )

    await session.start(
        agent=Agent(
            instructions=(
                "You are a real-time interpreter. Translate the speaker's speech "
                f"into {target_lang}, preserving tone and pace. Do not add commentary."
            )
        ),
        room=ctx.room,
    )


if __name__ == "__main__":
    # LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET / GEMINI_API_KEY 환경변수 필요
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
