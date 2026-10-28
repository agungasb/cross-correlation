import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0e17",
};

export const metadata: Metadata = {
  title: "3D Triad Market Analyzer | XAUEUR vs EURUSD vs Time",
  description:
    "Real-Time 3D Phase Space & Multi-Panel Quantitative Market Analyzer Platform powered by Next.js and Firebase.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "3D Triad",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Script src="/plotly.min.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
