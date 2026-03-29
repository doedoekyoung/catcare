// src/services/notificationService.ts
// REQ-V3-05: Push notification for incomplete items

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleIncompleteReminder(
  hour: number = 21,
  minute: number = 0
): Promise<void> {
  // Cancel existing reminders first
  await cancelIncompleteReminder();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🐱 오늘 루틴 확인',
      body: '아직 완료하지 않은 돌봄 항목이 있어요!',
      sound: true,
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function cancelIncompleteReminder(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = all.filter((n) =>
    n.content.title?.includes('루틴 확인')
  );
  await Promise.all(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

export async function sendImmediateNotification(
  title: string,
  body: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}
