import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Бүх зураг серверээс SVG/PNG-ээр үүсдэг тул Next-ийн image optimizer хэрэггүй
  images: { unoptimized: true },
};

export default nextConfig;
