import type { NextConfig } from "next";

// GitHub Pages serves the site under https://<user>.github.io/<repo>/.
// In production we need every link, asset, and Next.js chunk to use
// that prefix; in local dev we want the root path. The `BASE_PATH`
// env var is set by the deploy workflow.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Static HTML/JS/CSS export — no Node runtime needed at request time,
  // which is the only thing GitHub Pages can host.
  output: "export",
  // GH Pages doesn't serve through next/image's runtime optimizer.
  images: { unoptimized: true },
  // basePath/assetPrefix resolved per-environment so `next dev` still
  // works at `/` while the deployed bundle is correctly prefixed.
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
};

export default nextConfig;
