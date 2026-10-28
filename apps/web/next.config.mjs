/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TS (main: src/index.ts) — let Next transpile them.
  transpilePackages: ['@nexus/ui'],
  // Linting is owned by the workspace `eslint src` (root flat config), not `next lint`.
  // eslint-config-next is intentionally not a dependency, so skip Next's build-time lint.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
