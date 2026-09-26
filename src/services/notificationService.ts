// src/services/notificationService.ts
// REQ-V3-05: 오늘의 돌봄 루틴을 알려주는 일일 알림.
//
// 네이티브 전용 — expo-notifications는 예약(반복) 알림을 웹에서 지원하지 않는다
// (NotificationScheduler.web 모듈이 없어 scheduleNotificationAsync가 UnavailabilityError를
// 던짐). 모든 export가 Platform.OS === 'web'이면 즉시 반환/no-op.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// 하루 4번(오전 2회 · 오후 2회, 취침 시간 제외) 오늘의 루틴을 확인하라는 알림.
export const DAILY_REMINDER_HOURS = [9, 11, 18, 21] as const;

const REMINDER_CHANNEL_ID = 'daily-routine-reminder';
const REMINDER_TAG = 'daily-routine-reminder'; // 예약 취소 시 이 값으로 우리 알림만 식별
const ENABLED_STORAGE_KEY = '_cc_daily_reminders_enabled';

const REMINDER_MESSAGES: Record<number, { title: string; body: string }> = {
  9: { title: '아침 루틴 체크 시간', body: '오늘의 돌봄 루틴을 확인해보세요' },
  11: { title: '오전 루틴 확인', body: '아직 체크하지 않은 아침 루틴이 있는지 확인해보세요' },
  18: { title: '저녁 루틴 체크 시간', body: '오늘의 저녁 루틴을 확인해보세요' },
  21: { title: '오늘 하루 마무리', body: '오늘 루틴을 모두 완료했는지 확인해보세요' },
};

// Android 8+는 채널이 있어야 알림음·중요도가 안정적으로 적용된다.
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: '돌봄 루틴 알림',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function areDailyRemindersEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const v = await AsyncStorage.getItem(ENABLED_STORAGE_KEY);
    return v !== 'false'; // 기본값: 켜짐
  } catch {
    return true;
  }
}

export async function setDailyRemindersEnabled(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  await AsyncStorage.setItem(ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
  if (enabled) await scheduleDailyReminders();
  else await cancelDailyReminders();
}

export async function scheduleDailyReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelDailyReminders();
  await ensureAndroidChannel();
  for (const hour of DAILY_REMINDER_HOURS) {
    const msg = REMINDER_MESSAGES[hour];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title,
        body: msg.body,
        sound: true,
        data: { tag: REMINDER_TAG },
      },
      trigger:
        Platform.OS === 'android'
          ? { hour, minute: 0, repeats: true, channelId: REMINDER_CHANNEL_ID }
          : { hour, minute: 0, repeats: true },
    });
  }
}

export async function cancelDailyReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = all.filter((n) => n.content.data?.tag === REMINDER_TAG);
  await Promise.all(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

// 배지 = 오늘 남은 돌봄 항목 수(가구 전체 기준, 고양이 탭 필터와 무관).
// 예약 알림 자체에는 배지 숫자를 넣지 않는다 — 4개 슬롯을 몇 주 전에 미리 예약해두는
// 구조라, 예약 시점엔 미래의 남은 개수를 알 수 없다. 대신 실제 데이터가 바뀔 때
// (체크 토글, 앱 포그라운드 복귀 등) AppNavigator가 이 함수를 호출해 매번 다시 계산한다.
// 그래서 앱이 완전히 종료된 채로 알림만 울리는 동안에는 갱신되지 않고, 다음에 앱을 열 때
// (또는 포그라운드로 돌아올 때) 그 시점 기준 값으로 보정된다.
//
// iOS: Notifications.setBadgeCountAsync가 그대로 표준 APNs 배지 API라 신뢰할 수 있다.
//
// Android: 순수 API로만 세팅한 배지값(ShortcutBadger 경유)은 삼성 One UI 6.1(Android 14)
// 등 최신 기기에서 무시되고, 배지가 대신 "트레이에 실제로 떠 있는 알림 개수/번호"를
// 따른다(https://github.com/expo/expo/discussions/35109). 그래서 안드로이드는 조용한
// 지속 알림 하나를 유지하며 그 알림의 badge(=네이티브 setNumber)로 배지를 반영한다.
// 다 끝나면(count 0) 알림을 지워 배지도 함께 사라지게 한다.
const STATUS_NOTIFICATION_ID = 'daily-status-badge';
const STATUS_CHANNEL_ID = 'daily-status';

async function ensureStatusChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(STATUS_CHANNEL_ID, {
    name: '오늘 남은 할 일',
    importance: Notifications.AndroidImportance.LOW, // 소리·팝업 없이 트레이에만 조용히
  });
}

// ── 진단 정보 ──────────────────────────────────────────────────────────────────
// setBadgeCount의 모든 시도(성공/실패)를 기록해 관리 탭에서 바로 볼 수 있게 한다.
// 배지가 안 뜨는 문제는 코드가 조용히 실패해도 증상이 "그냥 안 보인다"뿐이라
// 원인 파악이 안 됐던 것 — 실패를 삼키지 않고 남겨서 실기기에서 바로 확인 가능하게 함.
export interface BadgeDebugInfo {
  timestamp: string;   // ISO
  platform: string;    // 'ios' | 'android' | 'web'
  osVersion: string | number;
  permission: string;  // granted | denied | undetermined | unknown
  remaining: number;   // 이번에 계산된 남은 할 일 수
  outcome: 'success' | 'error' | 'skipped-web';
  detail: string;      // 성공 시 알림 id 등, 실패 시 에러 메시지
}

const DEBUG_STORAGE_KEY = '_cc_badge_debug';
let _lastDebug: BadgeDebugInfo | null = null;

async function recordDebug(info: BadgeDebugInfo): Promise<void> {
  _lastDebug = info;
  try {
    await AsyncStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(info));
  } catch {}
}

// 메모리에 있으면 그걸(가장 최신), 없으면(예: 앱 재시작 직후) 저장된 마지막 값을 읽는다.
export async function getBadgeDebugInfo(): Promise<BadgeDebugInfo | null> {
  if (_lastDebug) return _lastDebug;
  try {
    const raw = await AsyncStorage.getItem(DEBUG_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BadgeDebugInfo) : null;
  } catch {
    return null;
  }
}

// 체크 토글처럼 store가 짧은 시간에 연속으로 바뀌면 AppNavigator가 setBadgeCount를
// 겹쳐서 여러 번 부른다. 각 호출은 채널 생성/알림 예약처럼 여러 단계의 비동기 네이티브
// 작업이라, await 없이 그냥 fire-and-forget으로 두면 나중에 시작된 호출(최신 값)의
// 네이티브 작업이 먼저 끝난 호출(오래된 값)보다 먼저 끝나버릴 수 있다 — 그러면 알림
// 본문(마지막에 쓴 텍스트)과 배지 숫자(실제로 마지막에 반영된 값)가 서로 다른 시점의
// 값으로 어긋난다("완료 → 완료 해제"처럼 store가 빠르게 두 번 바뀔 때 실제로 재현됨).
// 그래서 호출을 큐에 넣어 항상 호출된 순서대로 하나씩만 실행되게 한다.
let _badgeQueue: Promise<void> = Promise.resolve();

export function setBadgeCount(remaining: number): Promise<void> {
  const run = _badgeQueue.then(() => _setBadgeCountImpl(remaining));
  _badgeQueue = run.catch(() => undefined); // 이번 호출이 실패해도 다음 호출까지 막지 않음
  return run;
}

async function _setBadgeCountImpl(remaining: number): Promise<void> {
  const n = Math.max(0, remaining);
  const base = {
    timestamp: new Date().toISOString(),
    platform: Platform.OS,
    osVersion: Platform.Version,
    remaining: n,
  };

  if (Platform.OS === 'web') {
    await recordDebug({ ...base, permission: 'n/a', outcome: 'skipped-web', detail: '웹은 배지/예약 알림 미지원' });
    return;
  }

  const perm = await Notifications.getPermissionsAsync().catch(() => null);
  const permission = perm?.status ?? 'unknown';

  if (Platform.OS === 'ios') {
    try {
      const ok = await Notifications.setBadgeCountAsync(n);
      await recordDebug({
        ...base, permission,
        outcome: ok ? 'success' : 'error',
        detail: ok ? `setBadgeCountAsync(${n}) 성공` : 'setBadgeCountAsync가 false 반환(권한 없음 등)',
      });
    } catch (e: any) {
      await recordDebug({ ...base, permission, outcome: 'error', detail: e?.message ?? String(e) });
    }
    return;
  }

  // Android — 0이면 지속 알림을 지워서 배지도 함께 사라지게 함
  if (n === 0) {
    try {
      await Notifications.dismissNotificationAsync(STATUS_NOTIFICATION_ID);
      await recordDebug({ ...base, permission, outcome: 'success', detail: '남은 일 0개 — 상태 알림 제거' });
    } catch (e: any) {
      await recordDebug({ ...base, permission, outcome: 'error', detail: e?.message ?? String(e) });
    }
    return;
  }
  try {
    await ensureStatusChannel();
    const id = await Notifications.scheduleNotificationAsync({
      identifier: STATUS_NOTIFICATION_ID, // 같은 id로 다시 예약 → 쌓이지 않고 교체됨
      content: {
        title: '오늘 할 일이 남아있어요',
        body: `아직 ${n}개의 루틴이 남았어요`,
        badge: n,
        sound: false,
        sticky: true,      // 스와이프로 안 지워짐 — 실제로 다 끝나야만 사라져야 배지가 신뢰됨
        autoDismiss: false,
      },
      // { channelId }만 있는 트리거는 네이티브에서 ChannelAwareTrigger로 변환되는데,
      // 이건 SchedulableNotificationTrigger가 아니라서 "does not have a schedulable
      // trigger. Refusing to schedule." 예외가 난다(실기기 진단 정보로 확인함).
      // seconds 트리거(TimeIntervalTrigger)는 SchedulableNotificationTrigger를 구현하므로
      // 이걸로 채널을 지정 — 1초 뒤 실행되어 사실상 즉시 표시.
      trigger: { seconds: 1, channelId: STATUS_CHANNEL_ID },
    });
    await recordDebug({ ...base, permission, outcome: 'success', detail: `알림 예약됨 (id=${id})` });
  } catch (e: any) {
    await recordDebug({ ...base, permission, outcome: 'error', detail: e?.message ?? String(e) });
  }
}

export async function sendImmediateNotification(
  title: string,
  body: string
): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}
