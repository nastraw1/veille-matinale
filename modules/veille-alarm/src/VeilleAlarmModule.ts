import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  AlarmSound,
  NativePermissions,
  NativeScheduleStatus,
  VeilleAlarmModuleEvents,
} from './VeilleAlarm.types';

declare class VeilleAlarmModule extends NativeModule<VeilleAlarmModuleEvents> {
  syncAlarms(json: string): Promise<NativeScheduleStatus[]>;
  getAlarmStatuses(): Promise<NativeScheduleStatus[]>;
  rescheduleAll(): Promise<NativeScheduleStatus[]>;
  getPermissions(): Promise<NativePermissions>;
  openAppSettings(): boolean;
  openExactAlarmSettings(): boolean;
  openNotificationSettings(): boolean;
  openFullScreenIntentSettings(): boolean;
  openBatterySettings(): boolean;
  listAlarmSounds(): Promise<AlarmSound[]>;
  previewSound(uri: string | null): void;
  stopPreview(): void;
  stopRinging(): void;
  getRingingAlarmId(): number;
  getNextSystemAlarm(): number | null;
  showVigilNotification(title: string, text: string, endAt: number): void;
  hideVigilNotification(): void;
}

/**
 * `null` si le module natif n'est pas présent (ex. Expo Go) : l'interface l'indique alors
 * clairement et n'affiche jamais une alarme comme active.
 */
export default requireOptionalNativeModule<VeilleAlarmModule>('VeilleAlarm');
