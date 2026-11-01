export type AlarmEventType = 'fired' | 'stopped' | 'snoozed' | 'timeout' | 'rescheduled';

export type VeilleAlarmModuleEvents = {
  onAlarmEvent: (params: { type: AlarmEventType; alarmId: number }) => void;
};

/** Alarme telle que transmise au module natif. */
export interface NativeAlarmPayload {
  id: number;
  label: string;
  enabled: boolean;
  vibrate: boolean;
  soundUri: string | null;
  snoozeMinutes: number;
  ringMinutes: number;
  /** Heure fixe, ou heure de secours pour une alarme solaire. */
  hour: number;
  minute: number;
  /** 0 = dimanche … 6 = samedi */
  days: number[];
  solar: boolean;
  /** Instants absolus (ms) précalculés pour les alarmes solaires. */
  triggers: number[];
  /** Alarme unique (test) : pas d'heure de secours. */
  oneShot?: boolean;
}

export type ScheduleReason =
  | 'disabled'
  | 'no_occurrence'
  | 'exact_alarm_permission'
  | 'notifications_disabled'
  | 'not_scheduled'
  | null;

export interface NativeScheduleStatus {
  id: number;
  nextTriggerAt: number | null;
  scheduled: boolean;
  snoozed: boolean;
  reason: ScheduleReason;
}

export interface NativePermissions {
  sdkInt: number;
  notifications: boolean;
  exactAlarms: boolean;
  fullScreenIntent: boolean;
  ignoringBatteryOptimizations: boolean;
  manufacturer: string;
}

export interface AlarmSound {
  title: string;
  uri: string;
  kind: 'alarm' | 'ringtone';
}
