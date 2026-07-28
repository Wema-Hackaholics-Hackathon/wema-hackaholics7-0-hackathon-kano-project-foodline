import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  images: {
    // Image optimization runs through the browser-native path on Workers;
    // product images are served pre-sized from R2, so the optimizer is unnecessary.
    unoptimized: true,
  },
};

export default nextConfig;
