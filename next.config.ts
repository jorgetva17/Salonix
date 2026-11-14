import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Folga acima do limite de 2 MB da logo, para que arquivos maiores cheguem
    // ao validador e recebam a mensagem certa em vez de um erro genérico.
    serverActions: { bodySizeLimit: "10mb" },
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
