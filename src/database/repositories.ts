/** Accès aux données SQLite. Toutes les écritures sont immédiates (sauvegarde automatique). */
import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_ALARM, DEFAULT_SETTINGS } from '../constants/defaults';
import type { Activity, Alarm, LocationSetting, PrayerSession, Program, Settings } from '../types';

// ---------------------------------------------------------------- Paramètres

export async function loadSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (!(r.key in DEFAULT_SETTINGS)) continue;
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      /* valeur corrompue : défaut conservé */
    }
  }
  return out as unknown as Settings;
}

export async function saveSettings(db: SQLiteDatabase, patch: Partial<Settings>): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(patch)) {
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, JSON.stringify(value));
    }
  });
}

/** Valeurs internes (ex. veille en cours) stockées à côté des paramètres, préfixées « _ ». */
export async function getKV<T>(db: SQLiteDatabase, key: string): Promise<T | null> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', `_${key}`);
  if (!r) return null;
  try {
    return JSON.parse(r.value) as T;
  } catch {
    return null;
  }
}

export async function setKV(db: SQLiteDatabase, key: string, value: unknown): Promise<void> {
  if (value == null) await db.runAsync('DELETE FROM settings WHERE key = ?', `_${key}`);
  else await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', `_${key}`, JSON.stringify(value));
}

// ---------------------------------------------------------------- Localisations

interface LocationRow {
  id: number;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  source: LocationSetting['source'];
  last_used_at: number;
}

const toLocation = (r: LocationRow): LocationSetting => ({
  id: r.id,
  name: r.name,
  country: r.country,
  latitude: r.latitude,
  longitude: r.longitude,
  timezone: r.timezone,
  source: r.source,
  lastUsedAt: r.last_used_at,
});

export async function listLocations(db: SQLiteDatabase): Promise<LocationSetting[]> {
  const rows = await db.getAllAsync<LocationRow>('SELECT * FROM locations ORDER BY last_used_at DESC');
  return rows.map(toLocation);
}

/** Ajoute (ou réutilise si identique) une localisation et la marque comme la plus récente. */
export async function upsertLocation(
  db: SQLiteDatabase,
  loc: Omit<LocationSetting, 'id' | 'lastUsedAt'>,
): Promise<number> {
  const now = Date.now();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM locations WHERE name = ? AND ABS(latitude - ?) < 0.0001 AND ABS(longitude - ?) < 0.0001',
    loc.name,
    loc.latitude,
    loc.longitude,
  );
  if (existing) {
    await db.runAsync(
      'UPDATE locations SET last_used_at = ?, timezone = ?, country = ?, source = ? WHERE id = ?',
      now,
      loc.timezone,
      loc.country,
      loc.source,
      existing.id,
    );
    return existing.id;
  }
  const r = await db.runAsync(
    'INSERT INTO locations (name, country, latitude, longitude, timezone, source, last_used_at) VALUES (?,?,?,?,?,?,?)',
    loc.name,
    loc.country,
    loc.latitude,
    loc.longitude,
    loc.timezone,
    loc.source,
    now,
  );
  return r.lastInsertRowId;
}

export async function touchLocation(db: SQLiteDatabase, id: number) {
  await db.runAsync('UPDATE locations SET last_used_at = ? WHERE id = ?', Date.now(), id);
}

export async function deleteLocation(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM locations WHERE id = ?', id);
}

// ---------------------------------------------------------------- Alarmes

interface AlarmRow {
  id: number;
  label: string;
  enabled: number;
  mode: Alarm['mode'];
  hour: number;
  minute: number;
  solar_event: Alarm['solarEvent'];
  offset_minutes: number;
  days: string;
  vibrate: number;
  sound_uri: string | null;
  sound_name: string | null;
  snooze_minutes: number;
  ring_minutes: number;
  program_id: number | null;
}

function parseDays(s: string): number[] {
  try {
    const d = JSON.parse(s);
    if (Array.isArray(d) && d.length) return d.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6);
  } catch {
    /* ignore */
  }
  return [...DEFAULT_ALARM.days];
}

const toAlarm = (r: AlarmRow): Alarm => ({
  id: r.id,
  label: r.label,
  enabled: !!r.enabled,
  mode: r.mode,
  hour: r.hour,
  minute: r.minute,
  solarEvent: r.solar_event,
  offsetMinutes: r.offset_minutes,
  days: parseDays(r.days),
  vibrate: !!r.vibrate,
  soundUri: r.sound_uri,
  soundName: r.sound_name,
  snoozeMinutes: r.snooze_minutes,
  ringMinutes: r.ring_minutes,
  programId: r.program_id,
});

export async function listAlarms(db: SQLiteDatabase): Promise<Alarm[]> {
  const rows = await db.getAllAsync<AlarmRow>('SELECT * FROM alarms ORDER BY hour, minute, id');
  return rows.map(toAlarm);
}

export async function saveAlarm(db: SQLiteDatabase, a: Omit<Alarm, 'id'> & { id?: number }): Promise<number> {
  const params = [
    a.label,
    a.enabled ? 1 : 0,
    a.mode,
    a.hour,
    a.minute,
    a.solarEvent,
    a.offsetMinutes,
    JSON.stringify(a.days.length ? a.days : DEFAULT_ALARM.days),
    a.vibrate ? 1 : 0,
    a.soundUri,
    a.soundName,
    a.snoozeMinutes,
    a.ringMinutes,
    a.programId,
  ];
  if (a.id) {
    await db.runAsync(
      `UPDATE alarms SET label=?, enabled=?, mode=?, hour=?, minute=?, solar_event=?, offset_minutes=?, days=?,
        vibrate=?, sound_uri=?, sound_name=?, snooze_minutes=?, ring_minutes=?, program_id=? WHERE id=?`,
      ...params,
      a.id,
    );
    return a.id;
  }
  const r = await db.runAsync(
    `INSERT INTO alarms (label, enabled, mode, hour, minute, solar_event, offset_minutes, days, vibrate,
      sound_uri, sound_name, snooze_minutes, ring_minutes, program_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ...params,
  );
  return r.lastInsertRowId;
}

export async function deleteAlarm(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM alarms WHERE id = ?', id);
}

// ---------------------------------------------------------------- Programmes

interface ActivityRow {
  id: number;
  program_id: number;
  position: number;
  title: string;
  duration_minutes: number;
  enabled: number;
  bible_reference: string;
  prayer_topics: string;
}

const toActivity = (r: ActivityRow): Activity => ({
  id: r.id,
  programId: r.program_id,
  position: r.position,
  title: r.title,
  durationMinutes: r.duration_minutes,
  enabled: !!r.enabled,
  bibleReference: r.bible_reference,
  prayerTopics: r.prayer_topics,
});

export async function listPrograms(db: SQLiteDatabase): Promise<Program[]> {
  const progs = await db.getAllAsync<{ id: number; name: string; is_default: number }>(
    'SELECT id, name, is_default FROM programs ORDER BY is_default DESC, created_at',
  );
  const acts = await db.getAllAsync<ActivityRow>('SELECT * FROM activities ORDER BY program_id, position, id');
  return progs.map((p) => ({
    id: p.id,
    name: p.name,
    isDefault: !!p.is_default,
    activities: acts.filter((a) => a.program_id === p.id).map(toActivity),
  }));
}

export async function createProgram(db: SQLiteDatabase, name: string, copyFrom?: Program): Promise<number> {
  let id = 0;
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync('INSERT INTO programs (name, is_default, created_at) VALUES (?, 0, ?)', name, Date.now());
    id = r.lastInsertRowId;
    const src = copyFrom?.activities ?? [];
    for (const [i, a] of src.entries()) {
      await db.runAsync(
        `INSERT INTO activities (program_id, position, title, duration_minutes, enabled, bible_reference, prayer_topics)
         VALUES (?,?,?,?,?,?,?)`,
        id,
        i,
        a.title,
        a.durationMinutes,
        a.enabled ? 1 : 0,
        a.bibleReference,
        a.prayerTopics,
      );
    }
  });
  return id;
}

export async function renameProgram(db: SQLiteDatabase, id: number, name: string) {
  await db.runAsync('UPDATE programs SET name = ? WHERE id = ?', name, id);
}

export async function deleteProgram(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM activities WHERE program_id = ?', id);
  await db.runAsync('DELETE FROM programs WHERE id = ?', id);
}

export async function addActivity(db: SQLiteDatabase, programId: number, title: string, minutes: number) {
  const max = await db.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(position) AS m FROM activities WHERE program_id = ?',
    programId,
  );
  const r = await db.runAsync(
    'INSERT INTO activities (program_id, position, title, duration_minutes, enabled) VALUES (?,?,?,?,1)',
    programId,
    (max?.m ?? -1) + 1,
    title,
    minutes,
  );
  return r.lastInsertRowId;
}

export async function updateActivity(db: SQLiteDatabase, a: Activity) {
  await db.runAsync(
    `UPDATE activities SET title=?, duration_minutes=?, enabled=?, bible_reference=?, prayer_topics=?, position=?
     WHERE id=?`,
    a.title,
    a.durationMinutes,
    a.enabled ? 1 : 0,
    a.bibleReference,
    a.prayerTopics,
    a.position,
    a.id,
  );
}

export async function deleteActivity(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM activities WHERE id = ?', id);
}

/** Réécrit l'ordre des activités d'un programme selon la liste d'identifiants fournie. */
export async function reorderActivities(db: SQLiteDatabase, orderedIds: number[]) {
  await db.withTransactionAsync(async () => {
    for (const [i, id] of orderedIds.entries()) {
      await db.runAsync('UPDATE activities SET position = ? WHERE id = ?', i, id);
    }
  });
}

/** Applique des durées (même ordre que les activités activées). */
export async function setDurations(db: SQLiteDatabase, items: { id: number; minutes: number }[]) {
  await db.withTransactionAsync(async () => {
    for (const it of items) await db.runAsync('UPDATE activities SET duration_minutes = ? WHERE id = ?', it.minutes, it.id);
  });
}

// ---------------------------------------------------------------- Historique

interface SessionRow {
  id: number;
  program_id: number | null;
  program_name: string;
  started_at: number;
  ended_at: number;
  planned_seconds: number;
  actual_seconds: number;
  status: PrayerSession['status'];
  steps_completed: number;
  steps_total: number;
}

export async function listSessions(db: SQLiteDatabase): Promise<PrayerSession[]> {
  const rows = await db.getAllAsync<SessionRow>('SELECT * FROM sessions ORDER BY started_at DESC');
  return rows.map((r) => ({
    id: r.id,
    programId: r.program_id,
    programName: r.program_name,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    plannedSeconds: r.planned_seconds,
    actualSeconds: r.actual_seconds,
    status: r.status,
    stepsCompleted: r.steps_completed,
    stepsTotal: r.steps_total,
  }));
}

export async function insertSession(db: SQLiteDatabase, s: Omit<PrayerSession, 'id'>) {
  await db.runAsync(
    `INSERT INTO sessions (program_id, program_name, started_at, ended_at, planned_seconds, actual_seconds, status,
      steps_completed, steps_total) VALUES (?,?,?,?,?,?,?,?,?)`,
    s.programId,
    s.programName,
    s.startedAt,
    s.endedAt,
    s.plannedSeconds,
    s.actualSeconds,
    s.status,
    s.stepsCompleted,
    s.stepsTotal,
  );
}

export async function deleteSession(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM sessions WHERE id = ?', id);
}
