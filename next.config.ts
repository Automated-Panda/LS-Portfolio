import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static.wikia.nocookie.net" },
    ],
  },
};

export default nextConfig;
