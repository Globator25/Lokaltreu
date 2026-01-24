import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async rewrites() {
    const upstream =
      process.env.LOKALTREU_API_UPSTREAM ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      "http://127.0.0.1:3001";

    const staffUpstream = process.env.LOKALTREU_STAFF_API_UPSTREAM ?? upstream;

    return [
      {
        source: "/api/:path*",
        destination: `${upstream}/:path*`,
      },
      {
        source: "/staff-api/:path*",
        destination: `${staffUpstream}/:path*`,
      },
    ];
  },
};

export default nextConfig;
