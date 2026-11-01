/**
 * Logique pure du programme spirituel : horaires dynamiques, adaptation à une durée totale,
 * déroulement chronométré et statistiques de l'historique.
 */
import type { Activity, PrayerSession } from '../types';

export interface ScheduledStep {
  activity: Activity;
  /** Durée effective en secondes (après adaptation éventuelle). */
  seconds: number;
  /** Décalage de début par rapport au début de la veille, en secondes. */
  startOffset: number;
  start: Date;
  end: Date;
}

export function enabledActivities(activities: Activity[]): Activity[] {
  return [...activities].filter((a) => a.enabled).sort((a, b) => a.position - b.position);
}

export function totalMinutes(activities: Activity[]): number {
  return enabledActivities(activities).reduce((s, a) => s + a.durationMinutes, 0);
}

/**
 * Répartit `targetMinutes` proportionnellement aux durées existantes, en minutes entières
 * (méthode du plus fort reste), avec au minimum 1 minute par étape.
 */
export function scaleDurations(durations: number[], targetMinutes: number): number[] {
  const n = durations.length;
  if (n === 0) return [];
  const target = Math.max(Math.round(targetMinutes), n);
  const sum = durations.reduce((s, d) => s + Math.max(d, 0), 0);
  const weights = sum > 0 ? durations.map((d) => Math.max(d, 0) / sum) : durations.map(() => 1 / n);

  const raw = weights.map((w) => w * target);
  const base = raw.map((r) => Math.floor(r));
  let leftover = target - base.reduce((s, b) => s + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; leftover > 0; k = (k + 1) % n, leftover--) base[order[k].i] += 1;
  // Minimum 1 minute par étape : on prélève sur l'étape la plus longue.
  for (let i = 0; i < n; i++) {
    while (base[i] < 1) {
      const j = base.indexOf(Math.max(...base));
      base[j] -= 1;
      base[i] += 1;
    }
  }
  return base;
}

/** Construit l'horaire de la veille à partir d'une heure de début. */
export function buildSchedule(
  activities: Activity[],
  start: Date,
  targetMinutes?: number | null,
): ScheduledStep[] {
  const list = enabledActivities(activities);
  const minutes =
    targetMinutes && targetMinutes > 0
      ? scaleDurations(
          list.map((a) => a.durationMinutes),
          targetMinutes,
        )
      : list.map((a) => a.durationMinutes);
  let offset = 0;
  return list.map((activity, i) => {
    const seconds = Math.max(minutes[i], 0) * 60;
    const step: ScheduledStep = {
      activity,
      seconds,
      startOffset: offset,
      start: new Date(start.getTime() + offset * 1000),
      end: new Date(start.getTime() + (offset + seconds) * 1000),
    };
    offset += seconds;
    return step;
  });
}

/** Date de début de la veille : prochaine occurrence de l'heure choisie (ou aujourd'hui). */
export function startDateFor(hour: number, minute: number, reference: Date = new Date()): Date {
  const d = new Date(reference);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export interface Progress {
  index: number; // étape courante (−1 si terminé)
  elapsedInStep: number;
  remainingInStep: number;
  totalElapsed: number;
  totalSeconds: number;
  finished: boolean;
}

/** Position dans le programme après `elapsed` secondes de veille effective. */
export function progressAt(schedule: ScheduledStep[], elapsed: number): Progress {
  const totalSeconds = schedule.reduce((s, x) => s + x.seconds, 0);
  for (let i = 0; i < schedule.length; i++) {
    const st = schedule[i];
    if (elapsed < st.startOffset + st.seconds) {
      const inStep = Math.max(0, elapsed - st.startOffset);
      return {
        index: i,
        elapsedInStep: inStep,
        remainingInStep: st.seconds - inStep,
        totalElapsed: elapsed,
        totalSeconds,
        finished: false,
      };
    }
  }
  return {
    index: -1,
    elapsedInStep: 0,
    remainingInStep: 0,
    totalElapsed: Math.min(elapsed, totalSeconds),
    totalSeconds,
    finished: true,
  };
}

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Jours consécutifs (jusqu'à aujourd'hui, ou hier si rien aujourd'hui) avec une veille terminée. */
export function currentStreak(sessions: PrayerSession[], now: Date = new Date()): number {
  const days = new Set(sessions.filter((s) => s.status === 'completed').map((s) => dayKey(s.startedAt)));
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function bestStreak(sessions: PrayerSession[]): number {
  const days = [...new Set(sessions.filter((s) => s.status === 'completed').map((s) => dayKey(s.startedAt)))].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of days) {
    const [y, m, d] = k.split('-').map(Number);
    const cur = new Date(y, m - 1, d, 12);
    if (prev && Math.round((cur.getTime() - prev.getTime()) / 86_400_000) === 1) run++;
    else run = 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

export interface PeriodStats {
  sessions: number;
  completed: number;
  interrupted: number;
  totalSeconds: number;
  activeDays: number;
}

export function statsBetween(sessions: PrayerSession[], from: Date, to: Date): PeriodStats {
  const inRange = sessions.filter((s) => s.startedAt >= from.getTime() && s.startedAt < to.getTime());
  return {
    sessions: inRange.length,
    completed: inRange.filter((s) => s.status === 'completed').length,
    interrupted: inRange.filter((s) => s.status === 'interrupted').length,
    totalSeconds: inRange.reduce((t, s) => t + s.actualSeconds, 0),
    activeDays: new Set(inRange.map((s) => dayKey(s.startedAt))).size,
  };
}

/** Début de semaine (lundi 00:00) contenant `d`. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const shift = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - shift);
  return x;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
