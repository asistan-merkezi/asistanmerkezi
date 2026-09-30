import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker imajı için minimal sunucu çıktısı (Vodafone Cloud kurulumu, docs/vodafone-tasima.md).
  output: "standalone",
  // Üst dizindeki package-lock.json yüzünden proje kökü yanlış tahmin ediliyordu.
  turbopack: { root: __dirname },
};

export default nextConfig;
