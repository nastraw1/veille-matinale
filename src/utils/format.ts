/** Formatage français, sans dépendance à Intl (fiable hors ligne sur tous les Android). */
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const p2 = (n: number) => String(n).padStart(2, '0');

export function formatHM(d: Date | null | undefined, use24h = true): string {
  if (!d) return '—';
  return formatClock(d.getHours(), d.getMinutes(), use24h);
}

export function formatClock(h: number, m: number, use24h = true): string {
  if (use24h) return `${p2(h)}:${p2(m)}`;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${p2(m)} ${suffix}`;
}

export function formatHMS(d: Date): string {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

/** « 03h05 » comme dans le cahier des charges. */
export function formatH(d: Date): string {
  return `${p2(d.getHours())}h${p2(d.getMinutes())}`;
}

export function formatLongDate(d: Date): string {
  const s = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatShortDate(d: Date): string {
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function monthName(m: number) {
  return MONTHS[m];
}

/** Durée en secondes → « 1 h 05 min 30 s » / « 05:30 ». */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${p2(m)}:${p2(sec)}` : `${p2(m)}:${p2(sec)}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m ? `${h} h ${p2(m)} min` : `${h} h`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

export function formatMinutes(min: number): string {
  return formatDuration(min * 60);
}

/** Temps restant lisible : « dans 2 h 14 min ». */
export function formatIn(ms: number): string {
  if (ms <= 0) return 'maintenant';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `dans ${m} min`;
  return `dans ${h} h ${p2(m)} min`;
}

export function formatCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const eo = lon >= 0 ? 'E' : 'O';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${eo}`;
}
