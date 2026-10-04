import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bloc. A simple block based site for student taking notes",
    short_name: "Bloc",
    description: "A better way to organize and create your notes",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["productivity", "education"],
    // Self-list so getInstalledRelatedApps() can report this PWA as
    // installed (lets Settings hide the install card on devices that
    // already have it). Must be the origin the app was installed from.
    related_applications: [
      {
        platform: "webapp",
        url: `${SITE_URL}/manifest.webmanifest`,
      },
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
