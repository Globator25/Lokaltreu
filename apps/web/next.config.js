/** @type {import('next').NextConfig} */
module.exports = {
  output: "standalone",

  async rewrites() {
    const upstream = process.env.LOKALTREU_API_UPSTREAM ?? "http://127.0.0.1:3001";

    return [
      {
        source: "/api/:path*",
        destination: `${upstream}/:path*`,
      },
    ];
  },
};
