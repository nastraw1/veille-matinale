/**
 * Service d'alarmes : traduit les alarmes de l'application en programmation Android exacte
 * (module natif VeilleAlarm) et expose leur état RÉEL.
 */
import { Platform } from 'react-native';

import VeilleAlarm, {
  type AlarmSound,
  type NativeAlarmPayload,
  type NativePermissions,
  type NativeScheduleStatus,
} from '../../modules/veille-alarm';
import { SOLAR_PRECOMPUTE_DAYS } from '../constants/defaults';
import type { Alarm, LocationSetting, Settings } from '../types';
import { alarmSolarKey, upcomingTriggers } from './solarService';

export const isAlarmModuleAvailable = Platform.OS === 'android' && VeilleAlarm != null;

export function buildPayload(
  alarms: Alarm[],
  location: LocationSetting,
  settings: Settings,
  now: Date = new Date(),
): NativeAlarmPayload[] {
  return alarms.map((a) => {
    const solar = alarmSolarKey(a, settings.dawnReference) != null;
    const triggers = solar
      ? upcomingTriggers(a, now, location.latitude, location.longitude, settings.dawnReference, SOLAR_PRECOMPUTE_DAYS)
          .filter((t) => !t.fallback)
          .map((t) => t.at.getTime())
      : [];
    return {
      id: a.id,
      label: a.label || 'Veille matinale',
      enabled: a.enabled,
      vibrate: a.vibrate,
      soundUri: a.soundUri,
      snoozeMinutes: a.snoozeMinutes,
      ringMinutes: a.ringMinutes,
      hour: a.hour,
      minute: a.minute,
      days: a.days,
      solar,
      triggers,
    };
  });
}

export type StatusMap = Record<number, NativeScheduleStatus>;

const toMap = (list: NativeScheduleStatus[]): StatusMap => Object.fromEntries(list.map((s) => [s.id, s]));

/** Envoie toutes les alarmes au système et renvoie l'état réel de chacune. */
export const TEST_ALARM_ID = 999_999;

export async function syncAlarms(
  alarms: Alarm[],
  location: LocationSetting,
  settings: Settings,
  testAt: number | null = null,
): Promise<StatusMap> {
  if (!isAlarmModuleAvailable || !VeilleAlarm) return {};
  const payload = buildPayload(alarms, location, settings);
  if (testAt && testAt > Date.now()) {
    const d = new Date(testAt);
    payload.push({
      id: TEST_ALARM_ID,
      label: "Test d'alarme — Veille matinale",
      enabled: true,
      vibrate: true,
      soundUri: null,
      snoozeMinutes: 0,
      ringMinutes: 1,
      hour: d.getHours(),
      minute: d.getMinutes(),
      days: [d.getDay()],
      solar: true,
      triggers: [testAt],
      oneShot: true,
    });
  }
  return toMap(await VeilleAlarm.syncAlarms(JSON.stringify(payload)));
}

export async function getStatuses(): Promise<StatusMap> {
  if (!isAlarmModuleAvailable || !VeilleAlarm) return {};
  return toMap(await VeilleAlarm.getAlarmStatuses());
}

export async function getPermissions(): Promise<NativePermissions | null> {
  if (!isAlarmModuleAvailable || !VeilleAlarm) return null;
  return VeilleAlarm.getPermissions();
}

export async function listSounds(): Promise<AlarmSound[]> {
  if (!isAlarmModuleAvailable || !VeilleAlarm) return [];
  return VeilleAlarm.listAlarmSounds();
}

export const previewSound = (uri: string | null) => VeilleAlarm?.previewSound(uri);
export const stopPreview = () => VeilleAlarm?.stopPreview();
export const stopRinging = () => VeilleAlarm?.stopRinging();
export const openExactAlarmSettings = () => VeilleAlarm?.openExactAlarmSettings();
export const openNotificationSettings = () => VeilleAlarm?.openNotificationSettings();
export const openFullScreenSettings = () => VeilleAlarm?.openFullScreenIntentSettings();
export const openBatterySettings = () => VeilleAlarm?.openBatterySettings();
export const openAppSettings = () => VeilleAlarm?.openAppSettings();

export function subscribeAlarmEvents(cb: (type: string, alarmId: number) => void): () => void {
  if (!VeilleAlarm) return () => {};
  const sub = VeilleAlarm.addListener('onAlarmEvent', (e) => cb(e.type, e.alarmId));
  return () => sub.remove();
}

/** Libellé honnête de l'état d'une alarme. */
export function statusLabel(alarm: Alarm, status: NativeScheduleStatus | undefined): {
  text: string;
  tone: 'ok' | 'warn' | 'off';
} {
  if (!alarm.enabled) return { text: 'Désactivée', tone: 'off' };
  if (!isAlarmModuleAvailable) return { text: 'Non programmée (module natif absent)', tone: 'warn' };
  if (!status) return { text: 'Programmation en cours…', tone: 'warn' };
  if (!status.scheduled) {
    switch (status.reason) {
      case 'exact_alarm_permission':
        return { text: 'Inactive : autorisation « Alarmes » refusée', tone: 'warn' };
      case 'no_occurrence':
        return { text: 'Inactive : aucune occurrence calculable', tone: 'warn' };
      default:
        return { text: 'Inactive : non programmée', tone: 'warn' };
    }
  }
  if (status.reason === 'notifications_disabled') {
    return { text: 'Programmée, mais notifications bloquées', tone: 'warn' };
  }
  return { text: status.snoozed ? 'Active (répétition en cours)' : 'Active', tone: 'ok' };
}
