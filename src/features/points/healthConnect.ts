// Android 걸음수 정확도 (PRD REQ-PD-1) — Health Connect 일일 합계 조회.
//
// 왜 필요한가: expo-sensors 는 Android 에서 일일 조회를 지원하지 않아(watchStepCount 만)
//   "앱을 켜 둔 동안"만 누적된다. 여행자는 앱을 계속 켜 두지 않으므로 실제 걸음의 일부만 잡힌다.
//   Health Connect 는 OS 가 집계한 하루 총 걸음을 돌려주므로 이 격차를 없앤다.
//
// 도입 방식: **지연 로드 + 폴백**. 패키지(react-native-health-connect)가 설치되지 않았거나
//   네이티브가 포함되지 않은 빌드(Expo Go·기존 dev build)에서는 조용히 null 을 반환하고
//   기존 누적 방식이 그대로 동작한다. 설치·prebuild 절차는 docs/SETUP_EXTERNAL.md 참조.
//   (네이티브 의존성 추가와 재빌드는 배포 판단이 필요한 작업이라 코드만 먼저 붙여 둔다)
import { Platform } from 'react-native'

type HealthConnectModule = {
  initialize: () => Promise<boolean>
  requestPermission: (perms: any[]) => Promise<any>
  readRecords: (type: string, opts: any) => Promise<any>
  getSdkStatus?: () => Promise<number>
}

function load(): HealthConnectModule | null {
  if (Platform.OS !== 'android') return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-health-connect') as HealthConnectModule
  } catch {
    return null // 미설치·네이티브 미포함 → 폴백 경로 사용
  }
}

export function isHealthConnectAvailable(): boolean {
  return load() !== null
}

// 오늘(로컬 자정~현재) 걸음 합계. 사용 불가·권한 거부·오류 시 null → 호출부가 폴백한다.
export async function readTodaySteps(): Promise<number | null> {
  const hc = load()
  if (!hc) return null
  try {
    const ready = await hc.initialize()
    if (!ready) return null
    const granted = await hc.requestPermission([{ accessType: 'read', recordType: 'Steps' }])
    // 권한 응답 형태가 버전마다 달라(배열/객체) 넉넉하게 판정한다
    if (Array.isArray(granted) && granted.length === 0) return null

    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const res = await hc.readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: new Date().toISOString(),
      },
    })
    const records: any[] = Array.isArray(res) ? res : (res?.records ?? [])
    if (!records.length) return 0
    return records.reduce((sum, r) => sum + (Number(r?.count) || 0), 0)
  } catch {
    return null
  }
}
