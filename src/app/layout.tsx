import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "3D Triad Market Analyzer | XAUEUR vs EURUSD vs Time",
  description:
    "Real-Time 3D Phase Space & Multi-Panel Quantitative Market Analyzer Platform powered by Next.js and Firebase.",
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
