/**
 * Localisation : GPS (fonctionne sans Internet), liste de villes hors ligne, saisie manuelle.
 */
import * as Location from 'expo-location';

import { CITIES, type City } from '../constants/cities';
import type { LocationSetting } from '../types';

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Abidjan';
  } catch {
    return 'Africa/Abidjan';
  }
}

/** Distance orthodromique en km. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearestCity(lat: number, lon: number): { city: City; km: number } {
  let best = CITIES[0];
  let bestKm = Infinity;
  for (const c of CITIES) {
    const km = distanceKm(lat, lon, c.latitude, c.longitude);
    if (km < bestKm) {
      best = c;
      bestKm = km;
    }
  }
  return { city: best, km: bestKm };
}

export function searchCities(query: string): City[] {
  const q = normalize(query);
  if (!q) return CITIES;
  return CITIES.filter((c) => normalize(c.name).includes(q) || normalize(c.country).includes(q));
}

function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function validateCoordinates(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'La latitude doit être comprise entre −90 et 90.';
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return 'La longitude doit être comprise entre −180 et 180.';
  return null;
}

/** Saisie tolérante : accepte la virgule décimale. */
export function parseCoordinate(text: string): number {
  return Number(text.replace(',', '.').trim());
}

export type GpsResult =
  | { ok: true; location: Omit<LocationSetting, 'id' | 'lastUsedAt'> }
  | { ok: false; error: string };

/** Position GPS de l'appareil, avec l'autorisation de l'utilisateur. */
export async function locateWithGps(): Promise<GpsResult> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    return {
      ok: false,
      error: perm.canAskAgain
        ? "Autorisation de localisation refusée."
        : "Localisation bloquée : autorisez-la dans les réglages Android de l'application.",
    };
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    return { ok: false, error: 'La localisation (GPS) du téléphone est désactivée.' };
  }
  let pos: Location.LocationObject | null = null;
  try {
    pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), 25_000)),
    ]);
  } catch {
    pos = null;
  }
  if (!pos) pos = await Location.getLastKnownPositionAsync().catch(() => null);
  if (!pos) return { ok: false, error: "Position introuvable. Réessayez à l'extérieur ou saisissez les coordonnées." };

  const { latitude, longitude } = pos.coords;
  let name = '';
  let country = '';
  try {
    // Le géocodage inverse peut nécessiter Internet : facultatif.
    const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude });
    name = addr?.city || addr?.subregion || addr?.district || '';
    country = addr?.country || '';
  } catch {
    /* hors ligne */
  }
  if (!name) {
    const { city, km } = nearestCity(latitude, longitude);
    name = km < 30 ? city.name : `Position GPS (près de ${city.name})`;
    country = country || city.country;
  }
  return {
    ok: true,
    location: {
      name,
      country,
      latitude: Math.round(latitude * 10000) / 10000,
      longitude: Math.round(longitude * 10000) / 10000,
      timezone: deviceTimeZone(),
      source: 'gps',
    },
  };
}
