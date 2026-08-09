import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "만다라트",
  description: "스티커와 이미지로 꾸미는 만다라트 목표 관리 PWA",
  applicationName: "만다라트",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png"
  },
  appleWebApp: {
    capable: true,
    title: "만다라트",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("madalart-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})();`}
        </Script>
        {children}
        <Script src="/pwa-register.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
