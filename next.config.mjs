import path from "path";

const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: isProd ? "export" : undefined,
  outputFileTracingRoot: path.resolve(),
  ...(isProd
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: "/yahoo-proxy/:path*",
              destination: "https://query1.finance.yahoo.com/:path*",
            },
            {
              source: "/pyth-pro/:path*",
              destination: "https://pyth.dourolabs.app/:path*",
            },
          ];
        },
      }),
};

export default nextConfig;
