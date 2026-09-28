import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Retired routes from the earlier prototype point at their replacements.
  async redirects() {
    return [
      { source: "/intake", destination: "/scan", permanent: false },
      { source: "/cases", destination: "/issuer", permanent: false },
      { source: "/cases/:id", destination: "/issuer", permanent: false },
      { source: "/explorer", destination: "/dashboard", permanent: false },
      { source: "/login", destination: "/dashboard", permanent: false },
      { source: "/proof/:id", destination: "/verify", permanent: false },
    ];
  },
};

export default nextConfig;
