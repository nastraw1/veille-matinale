import type { Alarm, LocationSetting, Settings, SolarEventKey } from '../types';

export const DEFAULT_LOCATION: Omit<LocationSetting, 'id' | 'lastUsedAt'> = {
  name: 'Bouna',
  country: "Côte d'Ivoire",
  latitude: 9.27,
  longitude: -2.99,
  timezone: 'Africa/Abidjan',
  source: 'default',
};

export const DEFAULT_SETTINGS: Settings = {
  appMode: 'complete',
  prayerDurationMinutes: 60,
  startHour: 3,
  startMinute: 0,
  dawnReference: 'astronomicalDawn',
  activeProgramId: null,
  activeLocationId: null,
  showVigilNotification: true,
  keepScreenOn: true,
  use24h: true,
  scaleProgramToDuration: true,
};

export const DEFAULT_ALARM: Omit<Alarm, 'id'> = {
  label: 'Veille matinale',
  enabled: true,
  mode: 'fixed',
  hour: 3,
  minute: 0,
  solarEvent: 'sunrise',
  offsetMinutes: 120,
  days: [0, 1, 2, 3, 4, 5, 6],
  vibrate: true,
  soundUri: null,
  soundName: null,
  snoozeMinutes: 5,
  ringMinutes: 10,
  programId: null,
};

export const DEFAULT_PROGRAM = {
  name: 'Veille de 60 minutes',
  activities: [
    { title: 'Préparation et silence', durationMinutes: 5 },
    { title: 'Louange et adoration', durationMinutes: 10 },
    { title: 'Repentance et consécration', durationMinutes: 15 },
    { title: 'Intercession familiale', durationMinutes: 15 },
    { title: 'Lecture biblique et méditation', durationMinutes: 10 },
    { title: 'Actions de grâce', durationMinutes: 5 },
  ],
};

export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];
export const SNOOZE_PRESETS = [0, 5, 10, 15, 20, 30];
export const RING_PRESETS = [1, 3, 5, 10, 15, 20];

export const SOLAR_EVENT_LABELS: Record<SolarEventKey, string> = {
  sunrise: 'Lever du soleil',
  civilDawn: 'Aube civile (−6°)',
  nauticalDawn: 'Aube nautique (−12°)',
  astronomicalDawn: 'Aube astronomique (−18°)',
};

export const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export const DAY_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
/** Ordre d'affichage : lundi en premier. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Nombre de jours de déclenchements solaires précalculés transmis au module natif. */
export const SOLAR_PRECOMPUTE_DAYS = 120;
