import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    async redirects() {
        return [
            {
                source: '/industries/:slug',
                destination: '/',
                permanent: true,
            },
            {
                source: '/dashboard/appointments',
                destination: '/dashboard/events',
                permanent: true,
            },
            {
                source: '/dashboard/appointments/:id',
                destination: '/dashboard/events/:id',
                permanent: true,
            },
        ];
    },
};

export default nextConfig;
