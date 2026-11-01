import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_ALARM, DEFAULT_LOCATION, DEFAULT_PROGRAM, DEFAULT_SETTINGS } from '../constants/defaults';

export const DATABASE_NAME = 'veille-matinale.db';
const DATABASE_VERSION = 1;

/** Création / migration du schéma (appelée par SQLiteProvider.onInit avant tout rendu). */
export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        country TEXT NOT NULL DEFAULT '',
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        timezone TEXT NOT NULL,
        source TEXT NOT NULL,
        last_used_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        title TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        bible_reference TEXT NOT NULL DEFAULT '',
        prayer_topics TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_activities_program ON activities(program_id, position);
      CREATE TABLE IF NOT EXISTS alarms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        mode TEXT NOT NULL,
        hour INTEGER NOT NULL,
        minute INTEGER NOT NULL,
        solar_event TEXT NOT NULL,
        offset_minutes INTEGER NOT NULL,
        days TEXT NOT NULL,
        vibrate INTEGER NOT NULL,
        sound_uri TEXT,
        sound_name TEXT,
        snooze_minutes INTEGER NOT NULL,
        ring_minutes INTEGER NOT NULL,
        program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER,
        program_name TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        planned_seconds INTEGER NOT NULL,
        actual_seconds INTEGER NOT NULL,
        status TEXT NOT NULL,
        steps_completed INTEGER NOT NULL,
        steps_total INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
    `);
    await seed(db);
    version = 1;
  }
  // Migrations futures : if (version === 1) { …; version = 2; }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

async function seed(db: SQLiteDatabase) {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    const loc = await db.runAsync(
      'INSERT INTO locations (name, country, latitude, longitude, timezone, source, last_used_at) VALUES (?,?,?,?,?,?,?)',
      DEFAULT_LOCATION.name,
      DEFAULT_LOCATION.country,
      DEFAULT_LOCATION.latitude,
      DEFAULT_LOCATION.longitude,
      DEFAULT_LOCATION.timezone,
      DEFAULT_LOCATION.source,
      now,
    );
    const prog = await db.runAsync(
      'INSERT INTO programs (name, is_default, created_at) VALUES (?, 1, ?)',
      DEFAULT_PROGRAM.name,
      now,
    );
    for (const [i, a] of DEFAULT_PROGRAM.activities.entries()) {
      await db.runAsync(
        'INSERT INTO activities (program_id, position, title, duration_minutes, enabled) VALUES (?,?,?,?,1)',
        prog.lastInsertRowId,
        i,
        a.title,
        a.durationMinutes,
      );
    }
    const a = DEFAULT_ALARM;
    await db.runAsync(
      `INSERT INTO alarms (label, enabled, mode, hour, minute, solar_event, offset_minutes, days, vibrate,
        sound_uri, sound_name, snooze_minutes, ring_minutes, program_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      a.label,
      a.enabled ? 1 : 0,
      a.mode,
      a.hour,
      a.minute,
      a.solarEvent,
      a.offsetMinutes,
      JSON.stringify(a.days),
      a.vibrate ? 1 : 0,
      a.soundUri,
      a.soundName,
      a.snoozeMinutes,
      a.ringMinutes,
      prog.lastInsertRowId,
    );
    const settings = {
      ...DEFAULT_SETTINGS,
      activeProgramId: prog.lastInsertRowId,
      activeLocationId: loc.lastInsertRowId,
    };
    for (const [key, value] of Object.entries(settings)) {
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, JSON.stringify(value));
    }
  });
}
