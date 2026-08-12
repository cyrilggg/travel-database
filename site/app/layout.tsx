import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "./android-mobile.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://travel-map.brown-pear-9939.chatgpt.site"),
  title: "旅行地图",
  description: "沿着真实地形浏览中国单城市旅行攻略。",
  openGraph: {
    title: "旅行地图",
    description: "沿着真实地形浏览中国单城市旅行攻略。",
    type: "website",
    images: [
      {
        url: "/travel-map-og.png",
        width: 1672,
        height: 941,
        alt: "地形、河流与旅行路线构成的旅行地图",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "旅行地图",
    description: "沿着真实地形浏览中国单城市旅行攻略。",
    images: ["/travel-map-og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
