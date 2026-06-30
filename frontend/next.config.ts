import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'standalone',
    images: {
        // Serve modern formats automatically — AVIF first, WebP fallback
        formats: ['image/avif', 'image/webp'],

        // Responsive breakpoints for srcset generation
        deviceSizes: [640, 750, 828, 1080, 1200, 1920],

        // Fixed-size image variants (icons, thumbnails)
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

        // Minimum time between re-optimizations per image (1 week)
        minimumCacheTTL: 60 * 60 * 24 * 7,
    },
    turbopack: {
        // Silence the workspace-root warning — frontend is the Next.js root
        root: __dirname,
    },
};

export default nextConfig;
