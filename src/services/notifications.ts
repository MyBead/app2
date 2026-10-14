import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationPlan } from '../core/notify';

const CHANNEL_ID = 'hot-deals';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Выгодные акции',
    description: 'Новые акции, подходящие под ваши предпочтения',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function hasPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Shows a notification now, or at `at` (used to wait out quiet hours). */
export async function notify(title: string, body: string, at: Date | null, screen = 'top'): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { screen } },
    trigger: at
      ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID }
      : Platform.OS === 'android'
        ? { channelId: CHANNEL_ID }
        : null,
  });
}

export async function deliver(plan: NotificationPlan): Promise<void> {
  await notify(plan.title, plan.body, plan.deliverAt);
}
