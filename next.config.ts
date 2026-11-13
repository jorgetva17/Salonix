import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Upload de logo (até 2 MB) + overhead do multipart.
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
