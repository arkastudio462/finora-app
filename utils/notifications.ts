import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const UPDATE_CHANNEL_ID = 'updates';

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(UPDATE_CHANNEL_ID, {
    name: 'Pembaruan aplikasi',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    lightColor: '#f97316',
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

export interface UpdateNotificationInput {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function postUpdateNotification(input: UpdateNotificationInput): Promise<boolean> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return false;

    await Notifications.scheduleNotificationAsync({
      identifier: 'finora-update',
      content: {
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        sound: false,
      },
      trigger: Platform.OS === 'android' ? { channelId: UPDATE_CHANNEL_ID } : null,
    });
    return true;
  } catch {
    return false;
  }
}
