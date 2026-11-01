import { getSolarTimes, nextSolarEvent, nextTrigger, upcomingTriggers } from '../src/services/solarService';
import { DEFAULT_ALARM } from '../src/constants/defaults';
import type { Alarm } from '../src/types';

// Les tests s'exécutent avec TZ=Africa/Abidjan (UTC+0, comme Bouna).
const LAT = 9.27;
const LON = -2.99;

/** Références indépendantes calculées avec la bibliothèque Python « astral » (NOAA). */
const REF: Record<string, Record<string, string>> = {
  '2026-11-01': { sunrise: '06:01:49', civilDawn: '05:39:49', nauticalDawn: '05:14:56', astronomicalDawn: '04:50:04' },
  '2026-06-21': { sunrise: '05:54:00', civilDawn: '05:30:33', nauticalDawn: '05:03:40', astronomicalDawn: '04:36:18' },
  '2026-12-21': { sunrise: '06:22:39', civilDawn: '05:59:25', nauticalDawn: '05:33:13', astronomicalDawn: '05:07:02' },
  '2026-03-20': { sunrise: '06:16:21', civilDawn: '05:55:01', nauticalDawn: '05:30:49', astronomicalDawn: '05:06:31' },
};

function at(day: string, hms: string) {
  return new Date(`${day}T${hms}Z`);
}

const alarm = (patch: Partial<Alarm>): Alarm => ({ ...DEFAULT_ALARM, id: 1, ...patch });

describe('solarService — Bouna', () => {
  it('fuseau de test = UTC+0', () => {
    expect(new Date('2026-11-01T12:00:00Z').getTimezoneOffset()).toBe(0);
  });

  for (const [day, ref] of Object.entries(REF)) {
    it(`concorde avec la référence NOAA à ±2 min le ${day}`, () => {
      const t = getSolarTimes(new Date(`${day}T08:00:00Z`), LAT, LON);
      expect(t.warnings).toEqual([]);
      for (const key of Object.keys(ref) as (keyof typeof ref)[]) {
        const got = (t as any)[key] as Date;
        expect(got).toBeInstanceOf(Date);
        expect(Math.abs(got.getTime() - at(day, ref[key]).getTime())).toBeLessThan(120_000);
      }
    });
  }

  it("ordre : aube astronomique < nautique < civile < lever", () => {
    const t = getSolarTimes(new Date('2026-11-01T10:00:00Z'), LAT, LON);
    expect(t.astronomicalDawn!.getTime()).toBeLessThan(t.nauticalDawn!.getTime());
    expect(t.nauticalDawn!.getTime()).toBeLessThan(t.civilDawn!.getTime());
    expect(t.civilDawn!.getTime()).toBeLessThan(t.sunrise!.getTime());
  });

  it('prochain lever : le lendemain si celui du jour est passé', () => {
    const e = nextSolarEvent(new Date('2026-11-01T07:00:00Z'), LAT, LON, 'sunrise')!;
    expect(e.toISOString().slice(0, 10)).toBe('2026-11-02');
  });
});

describe('solarService — cas limites', () => {
  it('nuit polaire (Tromsø, décembre) : lever non défini, avertissement', () => {
    const t = getSolarTimes(new Date('2026-12-21T12:00:00Z'), 69.65, 18.96);
    expect(t.sunrise).toBeNull();
    expect(t.warnings.join(' ')).toMatch(/Nuit polaire/);
  });
  it('été à haute latitude (Paris, juin) : aube astronomique inexistante', () => {
    const t = getSolarTimes(new Date('2026-06-21T12:00:00Z'), 48.86, 2.35);
    expect(t.sunrise).not.toBeNull();
    expect(t.astronomicalDawn).toBeNull();
    expect(t.warnings.length).toBeGreaterThan(0);
  });
  it("alarme solaire incalculable : heure de secours utilisée", () => {
    const a = alarm({ mode: 'solarEvent', solarEvent: 'sunrise', hour: 6, minute: 30, offsetMinutes: 0 });
    const r = nextTrigger(a, new Date('2026-12-20T00:00:00Z'), 69.65, 18.96, 'astronomicalDawn')!;
    expect(r.fallback).toBe(true);
    expect(r.at.getUTCHours()).toBe(6);
    expect(r.at.getUTCMinutes()).toBe(30);
  });
});

describe('déclenchements des alarmes', () => {
  it('heure fixe 03:00 tous les jours', () => {
    const r = nextTrigger(alarm({}), new Date('2026-11-01T06:46:00Z'), LAT, LON, 'astronomicalDawn')!;
    expect(r.at.toISOString()).toBe('2026-11-02T03:00:00.000Z');
  });
  it('2 h avant le lever du soleil', () => {
    const r = nextTrigger(alarm({ mode: 'beforeSunrise', offsetMinutes: 120 }), new Date('2026-11-01T06:46:00Z'), LAT, LON, 'astronomicalDawn')!;
    // lever du 02/11 ≈ 06:02 → réveil ≈ 04:02
    expect(r.at.getUTCHours()).toBe(4);
    expect(r.at.getUTCMinutes()).toBeLessThanOrEqual(3);
    expect(r.fallback).toBe(false);
  });
  it("30 min avant l'aube choisie (nautique)", () => {
    const r = nextTrigger(alarm({ mode: 'beforeDawn', offsetMinutes: 30 }), new Date('2026-11-01T06:46:00Z'), LAT, LON, 'nauticalDawn')!;
    // aube nautique ≈ 05:15 → 04:45
    expect(r.at.getUTCHours()).toBe(4);
    expect(Math.abs(r.at.getUTCMinutes() - 45)).toBeLessThanOrEqual(2);
  });
  it('respecte les jours sélectionnés (lundi et jeudi)', () => {
    const list = upcomingTriggers(alarm({ days: [1, 4] }), new Date('2026-11-01T06:46:00Z'), LAT, LON, 'astronomicalDawn', 14);
    expect(list.length).toBe(4);
    for (const t of list) expect([1, 4]).toContain(t.at.getDay());
  });
  it('les horaires solaires suivent les saisons', () => {
    const a = alarm({ mode: 'beforeSunrise', offsetMinutes: 0 });
    const list = upcomingTriggers(a, new Date('2026-11-01T00:00:00Z'), LAT, LON, 'astronomicalDawn', 120);
    const times = new Set(list.map((t) => t.at.getUTCHours() * 60 + t.at.getUTCMinutes()));
    expect(times.size).toBeGreaterThan(10);
  });
});
