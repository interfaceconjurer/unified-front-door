import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  allowedDevOrigins: ["127.0.0.1"],
  // Hide the dev-only on-screen indicator (it overlapped the sidebar's
  // collapse control in the bottom-left corner).
  devIndicators: false,
};

export default nextConfig;
