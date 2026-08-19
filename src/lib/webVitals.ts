/**
 * Web Vitals monitoring utility.
 *
 * Tracks Core Web Vitals (FCP, LCP, CLS, INP) from real user sessions.
 * - Development: logs metrics to console
 * - Production: optionally reports to a monitoring endpoint
 *
 * @see https://web.dev/vitals/
 */

import type { Metric } from 'web-vitals';

/** Optional endpoint for production metric reporting */
const ANALYTICS_ENDPOINT = process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT;

function formatMetric(metric: Metric): string {
  const unit = metric.name === 'CLS' ? '' : 'ms';
  const value = metric.name === 'CLS'
    ? metric.value.toFixed(4)
    : `${Math.round(metric.value)}${unit}`;
  return `[Web Vitals] ${metric.name}: ${value} (${metric.rating})`;
}

function logMetric(metric: Metric): void {
  const message = formatMetric(metric);
  if (metric.rating === 'good') {
    console.log(`✅ ${message}`);
  } else if (metric.rating === 'needs-improvement') {
    console.warn(`⚠️ ${message}`);
  } else {
    console.error(`❌ ${message}`);
  }
}

function sendToAnalytics(metric: Metric): void {
  if (!ANALYTICS_ENDPOINT) return;

  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    navigationType: metric.navigationType,
    delta: metric.delta,
    timestamp: Date.now(),
  });

  // Use sendBeacon for reliability (fires even on page unload)
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(ANALYTICS_ENDPOINT, body);
  } else {
    fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Silently ignore reporting failures
    });
  }
}

function handleMetric(metric: Metric): void {
  if (process.env.NODE_ENV === 'development') {
    logMetric(metric);
  }

  // Always attempt to report to analytics endpoint if configured
  sendToAnalytics(metric);
}

/**
 * Initializes Core Web Vitals tracking.
 * Dynamically imports the web-vitals library to keep it off the critical path.
 */
export function initWebVitals(): void {
  if (typeof window === 'undefined') return;

  import('web-vitals').then(({ onFCP, onLCP, onCLS, onINP }) => {
    onFCP(handleMetric);
    onLCP(handleMetric);
    onCLS(handleMetric);
    onINP(handleMetric);
  }).catch(() => {
    // Silently fail — monitoring should never break the app
  });
}
