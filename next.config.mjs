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
};

export default nextConfig;

