
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mann's Intelligence",
    short_name: "Intelligence",
    description:
      "Smart Trading, Market Insights, and Stock Analysis.",

    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",

    background_color: "#09090b",
    theme_color: "#09090b",

    categories: ["finance", "business", "productivity"],

    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}