/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@nexus/ui"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
