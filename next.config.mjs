import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  eslint: {
    // Pre-existing lint issues are tracked separately; don't block builds.
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  // Emit browser source maps at build time so the error-monitoring provider can
  // symbolicate production stack traces (Phase 25, task 537.1). The maps are
  // generated here; uploading them to the monitoring service is handled by that
  // provider's build integration using NEXT_PUBLIC_SENTRY_DSN + a server-side
  // auth token (never committed).
  productionBrowserSourceMaps: true,

  // ── Security headers (Phase 25, task 542.2) ────────────────────────────────
  // Static, request-independent security headers applied to every response.
  // The Content-Security-Policy is *not* set here because it needs a per-request
  // nonce to block inline scripts while still allowing Next.js's own bootstrap
  // scripts — that lives in `src/middleware.ts`.
  //
  // Note: Vercel terminates TLS and serves everything over HTTPS automatically,
  // but Strict-Transport-Security must be sent by the app to instruct browsers
  // to pin HTTPS for future visits (including subdomains, with preload).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            // Force HTTPS for 2 years, cover subdomains, opt into the preload list.
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            // Stop browsers from MIME-sniffing responses away from the declared type.
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // Disallow the app being framed (clickjacking). CSP frame-ancestors
            // (set in middleware) is the modern equivalent; this covers old browsers.
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            // Only send the origin (not the full path/query) on cross-origin requests.
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // Deny access to powerful features the app doesn't use.
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);

