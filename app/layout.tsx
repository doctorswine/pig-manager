import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "피그매니저 | 농장 대시보드",
  description: "모돈 중심 양돈장 생산관리 대시보드",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
