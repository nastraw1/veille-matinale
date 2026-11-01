/**
 * État global de l'application, chargé depuis SQLite. Chaque modification est écrite
 * immédiatement en base (sauvegarde automatique) puis les alarmes sont reprogrammées.
 */
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { NativePermissions } from '../../modules/veille-alarm';
import { DEFAULT_LOCATION } from '../constants/defaults';
import * as repo from '../database/repositories';
import * as alarmService from '../services/alarmService';
import type { Alarm, LocationSetting, PrayerSession, Program, Settings } from '../types';

export interface ActiveVigil {
  programId: number | null;
  programName: string;
  startedAt: number;
  steps: { activityId: number; title: string; seconds: number; bibleReference: string; prayerTopics: string }[];
  pausedAccumMs: number;
  pausedAt: number | null;
  skipAdjustMs: number;
  alarmId: number | null;
}

interface Store {
  ready: boolean;
  settings: Settings;
  locations: LocationSetting[];
  location: LocationSetting;
  alarms: Alarm[];
  programs: Program[];
  sessions: PrayerSession[];
  statuses: alarmService.StatusMap;
  permissions: NativePermissions | null;
  vigil: ActiveVigil | null;
  syncError: string | null;

  updateSettings(patch: Partial<Settings>): Promise<void>;
  selectLocation(loc: Omit<LocationSetting, 'id' | 'lastUsedAt'>): Promise<void>;
  chooseSavedLocation(id: number): Promise<void>;
  removeLocation(id: number): Promise<void>;
  saveAlarm(a: Omit<Alarm, 'id'> & { id?: number }): Promise<number>;
  deleteAlarm(id: number): Promise<void>;
  reloadPrograms(): Promise<void>;
  reloadSessions(): Promise<void>;
  refreshAlarms(): Promise<void>;
  refreshPermissions(): Promise<void>;
  setVigil(v: ActiveVigil | null): Promise<void>;
  /** Programme une alarme de test unique dans `seconds` secondes. */
  scheduleTestAlarm(seconds: number): Promise<alarmService.StatusMap>;
}

const Ctx = createContext<Store | null>(null);

export function useAppStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useAppStore hors de AppStoreProvider');
  return s;
}

const fallbackLocation: LocationSetting = { ...DEFAULT_LOCATION, id: 0, lastUsedAt: 0 };

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [locations, setLocations] = useState<LocationSetting[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sessions, setSessions] = useState<PrayerSession[]>([]);
  const [statuses, setStatuses] = useState<alarmService.StatusMap>({});
  const [permissions, setPermissions] = useState<NativePermissions | null>(null);
  const [vigil, setVigilState] = useState<ActiveVigil | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const testAtRef = useRef<number | null>(null);

  const location = useMemo(() => {
    if (!settings) return fallbackLocation;
    return locations.find((l) => l.id === settings.activeLocationId) ?? locations[0] ?? fallbackLocation;
  }, [locations, settings]);

  // Référence vers les données les plus récentes pour la synchronisation des alarmes.
  const latest = useRef({ alarms, location, settings });
  latest.current = { alarms, location, settings };

  const syncNow = useCallback(async (a?: Alarm[], loc?: LocationSetting, st?: Settings) => {
    const al = a ?? latest.current.alarms;
    const lo = loc ?? latest.current.location;
    const se = st ?? latest.current.settings;
    if (!se) return;
    try {
      const s = await alarmService.syncAlarms(al, lo, se, testAtRef.current);
      setStatuses(s);
      setSyncError(null);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    }
    setPermissions(await alarmService.getPermissions().catch(() => null));
  }, []);

  // Chargement initial.
  useEffect(() => {
    (async () => {
      const [st, locs, als, progs, sess, v] = await Promise.all([
        repo.loadSettings(db),
        repo.listLocations(db),
        repo.listAlarms(db),
        repo.listPrograms(db),
        repo.listSessions(db),
        repo.getKV<ActiveVigil>(db, 'activeVigil'),
      ]);
      setSettings(st);
      setLocations(locs);
      setAlarms(als);
      setPrograms(progs);
      setSessions(sess);
      setVigilState(v);
      const loc = locs.find((l) => l.id === st.activeLocationId) ?? locs[0] ?? fallbackLocation;
      await syncNow(als, loc, st);
      setReady(true);
    })();
  }, [db, syncNow]);

  // Retour au premier plan : nouveaux horaires solaires, état réel des alarmes et autorisations.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && latest.current.settings) syncNow();
    });
    const unsub = alarmService.subscribeAlarmEvents(() => {
      alarmService.getStatuses().then(setStatuses).catch(() => {});
    });
    return () => {
      sub.remove();
      unsub();
    };
  }, [syncNow]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      if (!settings) return;
      const next = { ...settings, ...patch };
      setSettings(next);
      await repo.saveSettings(db, patch);
      if ('dawnReference' in patch || 'activeLocationId' in patch) await syncNow(undefined, undefined, next);
    },
    [db, settings, syncNow],
  );

  const reloadLocations = useCallback(async () => {
    const locs = await repo.listLocations(db);
    setLocations(locs);
    return locs;
  }, [db]);

  const activateLocation = useCallback(
    async (id: number) => {
      const locs = await reloadLocations();
      const loc = locs.find((l) => l.id === id) ?? fallbackLocation;
      if (!settings) return;
      const next = { ...settings, activeLocationId: id };
      setSettings(next);
      await repo.saveSettings(db, { activeLocationId: id });
      await syncNow(undefined, loc, next);
    },
    [db, reloadLocations, settings, syncNow],
  );

  const selectLocation = useCallback(
    async (loc: Omit<LocationSetting, 'id' | 'lastUsedAt'>) => {
      const id = await repo.upsertLocation(db, loc);
      await activateLocation(id);
    },
    [activateLocation, db],
  );

  const chooseSavedLocation = useCallback(
    async (id: number) => {
      await repo.touchLocation(db, id);
      await activateLocation(id);
    },
    [activateLocation, db],
  );

  const removeLocation = useCallback(
    async (id: number) => {
      if (settings?.activeLocationId === id) return; // on ne supprime pas la localisation active
      await repo.deleteLocation(db, id);
      await reloadLocations();
    },
    [db, reloadLocations, settings],
  );

  const saveAlarm = useCallback(
    async (a: Omit<Alarm, 'id'> & { id?: number }) => {
      const id = await repo.saveAlarm(db, a);
      const als = await repo.listAlarms(db);
      setAlarms(als);
      await syncNow(als);
      return id;
    },
    [db, syncNow],
  );

  const deleteAlarm = useCallback(
    async (id: number) => {
      await repo.deleteAlarm(db, id);
      const als = await repo.listAlarms(db);
      setAlarms(als);
      await syncNow(als);
    },
    [db, syncNow],
  );

  const reloadPrograms = useCallback(async () => {
    setPrograms(await repo.listPrograms(db));
  }, [db]);

  const reloadSessions = useCallback(async () => {
    setSessions(await repo.listSessions(db));
  }, [db]);

  const refreshPermissions = useCallback(async () => {
    setPermissions(await alarmService.getPermissions().catch(() => null));
  }, []);

  const setVigil = useCallback(
    async (v: ActiveVigil | null) => {
      setVigilState(v);
      await repo.setKV(db, 'activeVigil', v);
    },
    [db],
  );

  const scheduleTestAlarm = useCallback(async (seconds: number) => {
    testAtRef.current = Date.now() + seconds * 1000;
    const se = latest.current.settings;
    if (!se) return {};
    const st = await alarmService.syncAlarms(latest.current.alarms, latest.current.location, se, testAtRef.current);
    setStatuses(st);
    return st;
  }, []);

  const value: Store | null = settings
    ? {
        ready,
        settings,
        locations,
        location,
        alarms,
        programs,
        sessions,
        statuses,
        permissions,
        vigil,
        syncError,
        updateSettings,
        selectLocation,
        chooseSavedLocation,
        removeLocation,
        saveAlarm,
        deleteAlarm,
        reloadPrograms,
        reloadSessions,
        refreshAlarms: () => syncNow(),
        refreshPermissions,
        setVigil,
        scheduleTestAlarm,
      }
    : null;

  if (!value || !ready) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
