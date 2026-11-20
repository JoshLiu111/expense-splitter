import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Avatars are cropped to 256×256 in the browser, but the server checks
    // an upload against MAX_AVATAR_BYTES (2 MB, src/account/avatar-rules.ts)
    // itself, so this limit must stay above that one to let it through.
    serverActions: { bodySizeLimit: "3mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
