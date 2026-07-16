import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // standalone-трейсинг должен захватывать файлы из корня монорепо, а не только apps/web
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: [
    "@openvitals/common",
    "@openvitals/database",
    "@openvitals/blob-storage",
    "@openvitals/ai",
    "@openvitals/events",
    "@openvitals/sharing",
  ],
};

export default nextConfig;
