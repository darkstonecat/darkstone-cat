import type { NextConfig } from "next";
import { execSync } from "child_process";
import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';

const gitSha = process.env.VERCEL_GIT_COMMIT_SHA
  ?? (() => { try { return execSync("git rev-parse HEAD").toString().trim(); } catch { return "unknown"; } })();
const buildDate = new Date().toISOString().slice(0, 16).replace("T", " ");

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const analyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://httvpxakxaycqbagybym.supabase.co";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://cf.geekdo-images.com https://ludoya-images.s3.eu-west-par.io.cloud.ovh.net https://www.googletagmanager.com",
      "font-src 'self'",
      `connect-src 'self' https://*.google-analytics.com https://www.googletagmanager.com https://va.vercel-scripts.com https://vitals.vercel-insights.com ${supabaseUrl}`,
      "frame-src 'self' https://www.google.com",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Separate build directory for E2E tests to avoid lock conflicts with `npm run dev`
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  env: {
    NEXT_PUBLIC_BUILD_VERSION: gitSha.slice(0, 7),
    NEXT_PUBLIC_BUILD_DATE: buildDate,
  },
  experimental: {
    optimizePackageImports: ["react-icons"],
  },
  images: {
    qualities: [60, 75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cf.geekdo-images.com",
      },
      {
        protocol: "https",
        hostname: "ludoya-images.s3.eu-west-par.io.cloud.ovh.net",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // The card token is in the path: never leak it through the Referer header and keep the page
      // out of indexes even if the meta robots tag is missed. Later rules override earlier ones.
      {
        source: "/:locale(es|en)?/verify/:token",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Legacy route renamed in ecd08af (/pautes-de-conducta → /conduct)
      { source: "/pautes-de-conducta", destination: "/conduct", permanent: true },
      { source: "/:locale(es|en)/pautes-de-conducta", destination: "/:locale/conduct", permanent: true },
      // Default locale (ca) has no URL prefix. next-intl's middleware already
      // redirects /ca/* → /* but with a temporary 307; these run before the
      // middleware and make the redirect permanent (308) so search engines
      // consolidate signals on the unprefixed URL.
      { source: "/ca", destination: "/", permanent: true },
      { source: "/ca/:path*", destination: "/:path*", permanent: true },
    ];
  },
};

export default analyzer(withNextIntl(nextConfig));
