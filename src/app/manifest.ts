import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "eTinda — Sari-Sari Store POS & Management",
    short_name: "eTinda POS",
    description:
      "Offline-first Point of Sale, Inventory Movement Ledger, and Utang Management for Sari-Sari Stores.",
    start_url: "/pos",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#15803d",
    orientation: "any",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}

