/**
 * Moteur de calcul solaire — 100 % hors ligne, purement astronomique (algorithme SunCalc,
 * dérivé des formules d'astronomie de J. Meeus). Aucune donnée météo n'intervient.
 *
 * Seuils utilisés (hauteur du centre du soleil) :
 *   lever du soleil        −0,833°  (réfraction + demi-diamètre)
 *   aube civile            −6°
 *   aube nautique          −12°
 *   aube astronomique      −18°
 */
import * as SunCalc from 'suncalc';

import type { Alarm, SolarEventKey, SolarTimes } from '../types';

const MINUTE = 60_000;
const DAY = 86_400_000;

function valid(d: Date | null | undefined): Date | null {
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
}

/** Midi local (heure de l'appareil) du jour calendaire donné : ancre de calcul stable. */
export function localNoon(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

/**
 * Horaires solaires du matin pour le jour calendaire local de `date`.
 * Les événements impossibles (soleil qui ne descend pas assez sous l'horizon,
 * nuit ou jour polaire) valent `null` et un avertissement est fourni.
 */
export function getSolarTimes(date: Date, latitude: number, longitude: number): SolarTimes {
  const noon = localNoon(date);
  const t = SunCalc.getTimes(noon, latitude, longitude);

  // Un événement du matin doit tomber dans la fenêtre [midi − 18 h ; midi + 1 h].
  // Hors de cette fenêtre, il appartient à un autre jour (décalage fuseau/longitude) : on le rejette.
  const inMorning = (d: Date | null) =>
    d && d.getTime() >= noon.getTime() - 18 * 3_600_000 && d.getTime() <= noon.getTime() + 3_600_000 ? d : null;

  const sunrise = inMorning(valid(t.sunrise));
  const civilDawn = inMorning(valid(t.dawn));
  const nauticalDawn = inMorning(valid(t.nauticalDawn));
  const astronomicalDawn = inMorning(valid(t.nightEnd));

  const warnings: string[] = [];
  const pos = SunCalc.getPosition(valid(t.solarNoon) ?? noon, latitude, longitude);
  const noonAltitude = (pos.altitude * 180) / Math.PI;

  if (!sunrise) {
    warnings.push(
      noonAltitude < 0
        ? "Nuit polaire : le soleil ne se lève pas ce jour-là à cette latitude."
        : "Jour polaire : le soleil ne se couche pas, le lever n'est pas défini.",
    );
  }
  if (sunrise && !astronomicalDawn) {
    warnings.push("Le soleil ne descend pas à −18° sous l'horizon : l'aube astronomique n'existe pas ce jour-là.");
  }
  if (sunrise && astronomicalDawn && !nauticalDawn) {
    warnings.push("L'aube nautique ne peut pas être calculée normalement ce jour-là.");
  }
  if (sunrise && !civilDawn) {
    warnings.push("L'aube civile ne peut pas être calculée normalement ce jour-là.");
  }

  return {
    date: noon,
    sunrise,
    civilDawn,
    nauticalDawn,
    astronomicalDawn,
    sunset: valid(t.sunset),
    solarNoon: valid(t.solarNoon),
    warnings,
  };
}

export function eventTime(times: SolarTimes, key: SolarEventKey): Date | null {
  return times[key];
}

/** Prochaine occurrence (strictement future) d'un événement solaire, en cherchant jusqu'à 30 jours. */
export function nextSolarEvent(
  now: Date,
  latitude: number,
  longitude: number,
  key: SolarEventKey,
): Date | null {
  for (let i = 0; i < 30; i++) {
    const day = new Date(now.getTime() + i * DAY);
    const e = eventTime(getSolarTimes(day, latitude, longitude), key);
    if (e && e.getTime() > now.getTime()) return e;
  }
  return null;
}

export interface TriggerResult {
  at: Date;
  /** true si l'heure de secours a été utilisée (événement solaire incalculable). */
  fallback: boolean;
}

function fixedOn(day: Date, hour: number, minute: number): Date {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Référence solaire effective d'une alarme selon son mode. */
export function alarmSolarKey(alarm: Alarm, dawnReference: SolarEventKey): SolarEventKey | null {
  switch (alarm.mode) {
    case 'fixed':
      return null;
    case 'beforeSunrise':
      return 'sunrise';
    case 'beforeDawn':
      return dawnReference;
    case 'solarEvent':
      return alarm.solarEvent;
  }
}

/** Heure de déclenchement d'une alarme pour le jour calendaire local `day`. */
export function triggerForDay(
  alarm: Alarm,
  day: Date,
  latitude: number,
  longitude: number,
  dawnReference: SolarEventKey,
): TriggerResult {
  const key = alarmSolarKey(alarm, dawnReference);
  if (!key) return { at: fixedOn(day, alarm.hour, alarm.minute), fallback: false };
  const e = eventTime(getSolarTimes(day, latitude, longitude), key);
  if (!e) return { at: fixedOn(day, alarm.hour, alarm.minute), fallback: true };
  const at = new Date(e.getTime() - alarm.offsetMinutes * MINUTE);
  at.setSeconds(0, 0); // arrondi à la minute
  return { at, fallback: false };
}

/**
 * Liste des déclenchements futurs d'une alarme sur `days` jours.
 * Le jour de la semaine retenu est celui de l'événement solaire (ou de l'heure fixe).
 */
export function upcomingTriggers(
  alarm: Alarm,
  from: Date,
  latitude: number,
  longitude: number,
  dawnReference: SolarEventKey,
  days: number,
): TriggerResult[] {
  const out: TriggerResult[] = [];
  const start = localNoon(from);
  for (let i = -1; i <= days; i++) {
    const day = new Date(start.getTime() + i * DAY);
    // Correction des changements d'heure éventuels : on recale sur midi local.
    day.setHours(12, 0, 0, 0);
    if (!alarm.days.includes(day.getDay())) continue;
    const r = triggerForDay(alarm, day, latitude, longitude, dawnReference);
    if (r.at.getTime() > from.getTime()) out.push(r);
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function nextTrigger(
  alarm: Alarm,
  from: Date,
  latitude: number,
  longitude: number,
  dawnReference: SolarEventKey,
): TriggerResult | null {
  return upcomingTriggers(alarm, from, latitude, longitude, dawnReference, 8)[0] ?? null;
}
