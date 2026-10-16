'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Re-fetches the server-rendered page so parent changes appear on the display. If the network
// drops, a refresh simply fails and the next tick (or the "online" event) recovers.
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const timer = setInterval(refresh, seconds * 1000);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router, seconds]);
  return null;
}
