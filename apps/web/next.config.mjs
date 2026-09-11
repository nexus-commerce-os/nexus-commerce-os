/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: the site is served by a Cloudflare Worker from `out/`, and
  // the one server route it needs (POST /api/waitlist) lives in worker/index.ts.
  // Keeping a Next server alive just for that endpoint would mean running — and
  // paying for — a Node runtime to answer a single form submission.
  output: 'export',
  // Workspace packages ship raw TS (main: src/index.ts) — let Next transpile them.
  transpilePackages: ['@nexus/ui'],
  // Linting is owned by the workspace `eslint src` (root flat config), not `next lint`.
  // eslint-config-next is intentionally not a dependency, so skip Next's build-time lint.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
