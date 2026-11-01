import { buildSchedule, currentStreak, bestStreak, progressAt, scaleDurations, statsBetween, startOfWeek } from '../src/services/prayerService';
import { DEFAULT_PROGRAM } from '../src/constants/defaults';
import type { Activity, PrayerSession } from '../src/types';

const acts: Activity[] = DEFAULT_PROGRAM.activities.map((a, i) => ({
  id: i + 1, programId: 1, position: i, title: a.title, durationMinutes: a.durationMinutes,
  enabled: true, bibleReference: '', prayerTopics: '',
}));
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;

describe('programme spirituel', () => {
  it('reproduit le programme initial 03h00–04h00', () => {
    const s = buildSchedule(acts, new Date(2026, 10, 2, 3, 0));
    expect(s.map((x) => `${hm(x.start)}–${hm(x.end)}`)).toEqual([
      '03h00–03h05', '03h05–03h15', '03h15–03h30', '03h30–03h45', '03h45–03h55', '03h55–04h00',
    ]);
  });
  it("horaires recalculés depuis une autre heure de début", () => {
    const s = buildSchedule(acts, new Date(2026, 10, 2, 4, 30));
    expect(hm(s[0].start)).toBe('04h30');
    expect(hm(s[5].end)).toBe('05h30');
  });
  it('étape désactivée ignorée', () => {
    const s = buildSchedule(acts.map((a) => (a.id === 2 ? { ...a, enabled: false } : a)), new Date(2026, 10, 2, 3, 0));
    expect(s.length).toBe(5);
    expect(hm(s[s.length - 1].end)).toBe('03h50');
  });
  it.each([15, 30, 45, 90, 120, 37])('adaptation à %i minutes : somme exacte, 1 min minimum', (t) => {
    const r = scaleDurations([5, 10, 15, 15, 10, 5], t);
    expect(r.reduce((a, b) => a + b, 0)).toBe(t);
    expect(Math.min(...r)).toBeGreaterThanOrEqual(1);
  });
  it('adaptation à 120 min double les durées', () => {
    expect(scaleDurations([5, 10, 15, 15, 10, 5], 120)).toEqual([10, 20, 30, 30, 20, 10]);
  });
  it('progression dans le chronomètre', () => {
    const s = buildSchedule(acts, new Date(2026, 10, 2, 3, 0));
    const p = progressAt(s, 7 * 60);
    expect(p.index).toBe(1);
    expect(p.remainingInStep).toBe(8 * 60);
    expect(progressAt(s, 3600).finished).toBe(true);
  });
});

describe('statistiques', () => {
  const mk = (y: number, m: number, d: number, status: 'completed' | 'interrupted' = 'completed'): PrayerSession => ({
    id: 0, programId: 1, programName: 'P', startedAt: new Date(y, m, d, 3).getTime(), endedAt: 0,
    plannedSeconds: 3600, actualSeconds: status === 'completed' ? 3600 : 600, status, stepsCompleted: 6, stepsTotal: 6,
  });
  const sessions = [mk(2026, 9, 28), mk(2026, 9, 29), mk(2026, 9, 30), mk(2026, 9, 31), mk(2026, 10, 1, 'interrupted'), mk(2026, 9, 20)];
  it('jours consécutifs (veille terminée)', () => {
    expect(currentStreak(sessions, new Date(2026, 10, 1, 8))).toBe(4);
    expect(currentStreak(sessions, new Date(2026, 10, 3, 8))).toBe(0);
    expect(bestStreak(sessions)).toBe(4);
  });
  it('statistiques hebdomadaires', () => {
    const from = startOfWeek(new Date(2026, 10, 1));
    expect(from.getDay()).toBe(1);
    const st = statsBetween(sessions, from, new Date(from.getTime() + 7 * 86400000));
    expect(st.sessions).toBe(5);
    expect(st.interrupted).toBe(1);
  });
});
