import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Salonix",
    short_name: "Salonix",
    description: "Gestão para barbearias e salões: agenda, caixa, estoque e equipe.",
    lang: "pt-BR",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#1B3B4B",
    background_color: "#F5F7F8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
