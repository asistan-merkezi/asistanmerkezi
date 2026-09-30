import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker imajı için minimal sunucu çıktısı (Vodafone Cloud kurulumu, docs/vodafone-tasima.md).
  output: "standalone",
};

export default nextConfig;
