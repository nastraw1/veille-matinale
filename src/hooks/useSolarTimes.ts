import { useMemo } from 'react';

import { getSolarTimes, nextSolarEvent } from '../services/solarService';
import type { LocationSetting, SolarEventKey } from '../types';

/** Horaires du jour + prochain événement, recalculés une fois par minute au plus. */
export function useSolarTimes(now: Date, location: LocationSetting, dawnKey: SolarEventKey) {
  const minuteKey = Math.floor(now.getTime() / 60000);
  return useMemo(() => {
    const ref = new Date(minuteKey * 60000);
    const today = getSolarTimes(ref, location.latitude, location.longitude);
    const nextSunrise = nextSolarEvent(ref, location.latitude, location.longitude, 'sunrise');
    const nextDawn = nextSolarEvent(ref, location.latitude, location.longitude, dawnKey);
    // Horaires du « prochain matin » : aujourd'hui si le lever n'est pas passé, sinon demain.
    const morning =
      today.sunrise && today.sunrise.getTime() > ref.getTime()
        ? today
        : getSolarTimes(new Date(ref.getTime() + 86_400_000), location.latitude, location.longitude);
    return { today, morning, nextSunrise, nextDawn };
  }, [minuteKey, location.latitude, location.longitude, dawnKey]);
}
