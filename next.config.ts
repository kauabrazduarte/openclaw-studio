import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/studio",
  serverExternalPackages: ["ws", "better-sqlite3"],
};

export default nextConfig;
