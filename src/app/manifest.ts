import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "人生アルバム",
    short_name: "人生アルバム",
    description: "自分の人生を一冊の物語に。",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#f6f1e7",
    lang: "ja",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
