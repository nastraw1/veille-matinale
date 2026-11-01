/** Types partagés de l'application VEILLE MATINALE. */

export type SolarEventKey = 'sunrise' | 'civilDawn' | 'nauticalDawn' | 'astronomicalDawn';

/** Mode de calcul d'une alarme. */
export type AlarmMode =
  | 'fixed' // Réveil à heure fixe
  | 'beforeSunrise' // Réveil X minutes avant le lever du soleil
  | 'beforeDawn' // Réveil X minutes avant l'aube (référence d'aube choisie)
  | 'solarEvent'; // Réveil calculé à partir d'un événement solaire quelconque (+/- décalage)

export type AppMode = 'clock' | 'program' | 'complete';

export interface LocationSetting {
  id: number;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  source: 'default' | 'manual' | 'gps' | 'list';
  lastUsedAt: number;
}

export interface Alarm {
  id: number;
  label: string;
  enabled: boolean;
  mode: AlarmMode;
  /** Heure fixe (mode 'fixed') ou heure de secours si l'événement solaire est incalculable. */
  hour: number;
  minute: number;
  /** Événement solaire de référence (modes solaires). */
  solarEvent: SolarEventKey;
  /** Minutes AVANT l'événement (valeur négative = après). */
  offsetMinutes: number;
  /** Jours actifs, 0 = dimanche … 6 = samedi. Jamais vide. */
  days: number[];
  vibrate: boolean;
  soundUri: string | null; // null = sonnerie d'alarme par défaut du téléphone
  soundName: string | null;
  snoozeMinutes: number; // 0 = répétition désactivée
  ringMinutes: number; // durée maximale de sonnerie
  programId: number | null;
}

export interface Activity {
  id: number;
  programId: number;
  position: number;
  title: string;
  durationMinutes: number;
  enabled: boolean;
  bibleReference: string;
  prayerTopics: string;
}

export interface Program {
  id: number;
  name: string;
  isDefault: boolean;
  activities: Activity[];
}

export interface Settings {
  appMode: AppMode;
  prayerDurationMinutes: number;
  startHour: number;
  startMinute: number;
  /** Aube affichée sur l'accueil et utilisée par le mode « avant l'aube ». */
  dawnReference: Exclude<SolarEventKey, 'sunrise'>;
  activeProgramId: number | null;
  activeLocationId: number | null;
  showVigilNotification: boolean;
  keepScreenOn: boolean;
  use24h: boolean;
  /** Ajuster automatiquement les durées du programme à la durée de prière choisie. */
  scaleProgramToDuration: boolean;
}

export type SessionStatus = 'completed' | 'interrupted';

export interface PrayerSession {
  id: number;
  programId: number | null;
  programName: string;
  startedAt: number;
  endedAt: number;
  plannedSeconds: number;
  actualSeconds: number;
  status: SessionStatus;
  stepsCompleted: number;
  stepsTotal: number;
}

export interface SolarTimes {
  date: Date;
  sunrise: Date | null;
  civilDawn: Date | null;
  nauticalDawn: Date | null;
  astronomicalDawn: Date | null;
  sunset: Date | null;
  solarNoon: Date | null;
  /** Message lorsqu'un ou plusieurs événements ne peuvent pas être calculés. */
  warnings: string[];
}
