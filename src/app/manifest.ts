import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Lifemetric";

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
        src: "/next.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/globe.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
