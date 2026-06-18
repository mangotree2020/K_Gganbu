package expo.modules.speakerroute

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// 출력 라우팅 전환 — 이어폰 사용 중 '내 발화 통역'만 스피커로 내보내기 위함.
// API 31+ 는 setCommunicationDevice(스피커), 그 이하는 isSpeakerphoneOn 사용.
class SpeakerRouteModule : Module() {
  private fun audioManager(): AudioManager? {
    val ctx = appContext.reactContext ?: return null
    return ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
  }

  override fun definition() = ModuleDefinition {
    Name("SpeakerRoute")

    // on=true: 내장 스피커로 강제(통신 모드), false: 통신 디바이스 해제 + MODE_NORMAL 복귀.
    // MODE_NORMAL로 돌려야 블루투스 A2DP(고음질 미디어) 재생이 정상 동작한다
    // (통신 모드는 A2DP를 막아 상대 통역이 이어폰으로 안 들리는 문제 발생).
    Function("setSpeaker") { on: Boolean ->
      val am = audioManager() ?: return@Function false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (on) {
          am.mode = AudioManager.MODE_IN_COMMUNICATION
          val spk = am.availableCommunicationDevices.firstOrNull {
            it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
          }
          if (spk != null) am.setCommunicationDevice(spk) else false
        } else {
          am.clearCommunicationDevice()
          am.mode = AudioManager.MODE_NORMAL
          true
        }
      } else {
        am.mode = if (on) AudioManager.MODE_IN_COMMUNICATION else AudioManager.MODE_NORMAL
        @Suppress("DEPRECATION")
        am.isSpeakerphoneOn = on
        true
      }
    }

    // 세션 종료 시 오디오 모드 원복
    Function("reset") {
      val am = audioManager()
      if (am != null) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          am.clearCommunicationDevice()
        } else {
          @Suppress("DEPRECATION")
          am.isSpeakerphoneOn = false
        }
        am.mode = AudioManager.MODE_NORMAL
      }
      true
    }
  }
}
