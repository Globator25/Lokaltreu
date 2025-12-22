import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const localCacheDir = path.join(__dirname, ".next-swc-cache");
if (!process.env.NEXT_SWC_PATH) {
  process.env.NEXT_SWC_PATH = localCacheDir;
}

if (!process.env.XDG_CACHE_HOME) {
  process.env.XDG_CACHE_HOME = path.join(__dirname, ".cache");
}

if (!process.env.HOME || process.env.HOME === "/home/user") {
  process.env.HOME = path.join(__dirname, ".home");
}

for (const dir of [process.env.NEXT_SWC_PATH, process.env.XDG_CACHE_HOME, process.env.HOME]) {
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
