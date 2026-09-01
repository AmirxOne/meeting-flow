import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "مهرسا — مدیریت جلسات سازمانی",
    short_name: "مهرسا",
    description: "جلسات من، پاسخ دعوت و زمان‌بندی سازمانی",
    start_url: "/meetings",
    scope: "/",
    display: "standalone",
    dir: "rtl",
    lang: "fa",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#0d0d0d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
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
