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
export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {}
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
