import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const base = 'https://attendlyx.com';
    return [
        { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
        { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
        { url: `${base}/features`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
        { url: `${base}/industries/dentists`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: `${base}/industries/auto-repair`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: `${base}/industries/salons`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: `${base}/login`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${base}/register`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
    ];
}
