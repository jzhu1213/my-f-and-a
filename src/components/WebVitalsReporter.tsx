'use client';

/**
 * Client component that initializes Core Web Vitals tracking.
 * Renders nothing — purely a side-effect component.
 */

import { useEffect } from 'react';
import { initWebVitals } from '../lib/webVitals';
import { initErrorMonitoring } from '../lib/errorMonitoring';

export function WebVitalsReporter() {
  useEffect(() => {
    // Install global error + unhandled-rejection handlers before vitals so
    // early failures during boot are captured (Phase 25, tasks 537.1/537.3).
    initErrorMonitoring();
    initWebVitals();
  }, []);

  return null;
}
