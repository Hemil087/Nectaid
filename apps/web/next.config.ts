import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // required for Docker
};

export default nextConfig;
