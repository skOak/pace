'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function VisitorTracker() {
  const pathname = usePathname();
  const trackedPathRef = useRef<string>('');

  useEffect(() => {
    // Only track if pathname actually changed to avoid strictly double-firing in React 18 Strict Mode
    if (pathname && pathname !== trackedPathRef.current) {
      trackedPathRef.current = pathname;
      
      // Fire and forget
      fetch('/api/track/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathname })
      }).catch(err => {
        // Silent catch
      });
    }
  }, [pathname]);

  return null;
}
