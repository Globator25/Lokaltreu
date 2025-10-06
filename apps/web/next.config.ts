import type { NextConfig } from 'next';

const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

// Enable Turbopack only during local development — disable in CI where
// Turbopack may resolve server-only modules into client bundles and fail.
// Use a relaxed type for experimental to allow turbopack key during local dev.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- localized: turbopack experimental key
const experimental: any = isCi
  ? {}
  : {
      turbopack: {
        // Project root is two levels up from apps/web
        root: '../..',
      },
    };

const nextConfig: NextConfig = {
  experimental,
};

export default nextConfig;