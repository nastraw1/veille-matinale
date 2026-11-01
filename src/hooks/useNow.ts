import { useEffect, useState } from 'react';

/** Heure courante, rafraîchie à chaque seconde (alignée sur le changement de seconde). */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs) + 5);
    };
    timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs) + 5);
    return () => clearTimeout(timer);
  }, [intervalMs]);
  return now;
}
