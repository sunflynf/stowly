import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("app");
  return {
    name: t("name"),
    short_name: t("name"),
    description: t("tagline"),
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F5F4",
    theme_color: "#0B6E63",
    lang: "vi",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Thêm món đồ / Add item", url: "/items/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Cảnh báo / Alerts", url: "/alerts", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
