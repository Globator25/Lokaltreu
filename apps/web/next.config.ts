import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  ...(process.env.NODE_ENV === "development"
    ? {
        allowedDevOrigins: [
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
          "http://127.0.0.1:3002",
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
        ],
      }
    : {}),

  async rewrites() {
    const upstream =
      process.env.LOKALTREU_API_UPSTREAM ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      "http://127.0.0.1:3001";
    const upstreamOverride = process.env.LOKALTREU_API_UPSTREAM;

    const staffUpstream = process.env.LOKALTREU_STAFF_API_UPSTREAM ?? upstream;

    return [
      {
        source: "/api/:path*",
        destination: `${upstream}/:path*`,
      },
      ...(upstreamOverride
        ? [
            {
              source: "/stamps/:path*",
              destination: `${upstreamOverride}/stamps/:path*`,
            },
            {
              source: "/referrals/:path*",
              destination: `${upstreamOverride}/referrals/:path*`,
            },
            {
              source: "/rewards/:path*",
              destination: `${upstreamOverride}/rewards/:path*`,
            },
            {
              source: "/devices/:path*",
              destination: `${upstreamOverride}/devices/:path*`,
            },
            {
              source: "/admins/:path*",
              destination: `${upstreamOverride}/admins/:path*`,
            },
            {
              source: "/.well-known/:path*",
              destination: `${upstreamOverride}/.well-known/:path*`,
            },
          ]
        : []),
      {
        source: "/staff-api/:path*",
        destination: `${staffUpstream}/:path*`,
      },
      {
        source: "/dsr/:path*",
        destination: `${upstream}/dsr/:path*`,
      },
      {
        source: "/dsr",
        destination: `${upstream}/dsr`,
      },
    ];
  },
};

export default nextConfig;
