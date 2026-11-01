/** Autorisation POST_NOTIFICATIONS (Android 13+) et notification persistante de veille. */
import { PermissionsAndroid, Platform } from 'react-native';

import VeilleAlarm from '../../modules/veille-alarm';

export type NotificationPermission = 'granted' | 'denied' | 'blocked';

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (Platform.OS !== 'android') return 'granted';
  if (Number(Platform.Version) < 33) return 'granted'; // accordée à l'installation avant Android 13
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS, {
    title: 'Notifications',
    message: "VEILLE MATINALE a besoin des notifications pour afficher et faire sonner vos réveils.",
    buttonPositive: 'Autoriser',
    buttonNegative: 'Plus tard',
  });
  if (r === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  if (r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Number(Platform.Version) < 33) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
}

export function showVigilNotification(title: string, text: string, endAt: Date) {
  try {
    VeilleAlarm?.showVigilNotification(title, text, endAt.getTime());
  } catch {
    /* sans effet si les notifications sont refusées */
  }
}

export function hideVigilNotification() {
  try {
    VeilleAlarm?.hideVigilNotification();
  } catch {
    /* ignore */
  }
}
