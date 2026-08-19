'use client';

/**
 * Client component that initializes Core Web Vitals tracking.
 * Renders nothing — purely a side-effect component.
 */

import { useEffect } from 'react';
import { initWebVitals } from '../lib/webVitals';

export function WebVitalsReporter() {
  useEffect(() => {
    initWebVitals();
  }, []);

  return null;
}
