import type { NextConfig } from 'next';

const nextConfig = {
  // Wir fügen diese Konfiguration hinzu:
  experimental: {
    turbopack: {
      // Wir sagen Turbopack, dass die Projektwurzel zwei Ebenen nach oben liegt
      root: '../..',
    },
  },
} as NextConfig;

export default nextConfig;