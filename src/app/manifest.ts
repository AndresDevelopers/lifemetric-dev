import type { MetadataRoute } from "next";
import { getPublicAppFaviconUrl, getPublicAppIconUrl, getPublicAppName } from "@/lib/appBranding";

export default function manifest(): MetadataRoute.Manifest {
  const appName = getPublicAppName();
  const appIconUrl = getPublicAppIconUrl();
  const appFaviconUrl = getPublicAppFaviconUrl();

  return {
    name: appName,
    short_name: appName,
    description: "Sistema clínico para diabéticos",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4f3",
    theme_color: "#5b67f1",
    lang: "es",
    icons: [
      {
        src: appIconUrl,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: appIconUrl,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: appFaviconUrl,
        sizes: "48x48",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
