import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "가족 발명소 — 함께 생각하고, 함께 만들어요",
  description: "아이의 생각에서 시작하는 가족 발명소. 대화, 발견, 설계, 3D펜 제작을 함께 안내합니다.",
  appleWebApp: { capable: true, title: "가족 발명소", statusBarStyle: "default" },
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f3ec" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // HWP 같은 브라우저 확장이 추가하는 html 속성 차이는 루트에서만 허용합니다.
  return <html lang="ko" suppressHydrationWarning><body>{children}</body></html>;
}
