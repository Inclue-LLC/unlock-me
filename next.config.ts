import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "nodemailer"],
  images: { unoptimized: false },
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};

export default nextConfig;
