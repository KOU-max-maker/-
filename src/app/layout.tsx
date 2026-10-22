import type { Metadata, Viewport } from "next";
import { Noto_Serif_JP } from "next/font/google";
import "./globals.css";

const serif = Noto_Serif_JP({
  variable: "--font-serif-jp",
  weight: ["400", "600"],
  preload: false,
});

export const metadata: Metadata = {
  title: "人生アルバム",
  description: "自分の人生を一冊の物語に。",
  appleWebApp: { capable: true, title: "人生アルバム", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1915" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${serif.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
