import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async rewrites() {
    const upstream =
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.LOKALTREU_API_UPSTREAM ??
      "http://127.0.0.1:3001";

    return [
      {
        source: "/api/:path*",
        destination: `${upstream}/:path*`,
      },
    ];
  },
};

export default nextConfig;
