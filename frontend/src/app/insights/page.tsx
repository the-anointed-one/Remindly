import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import { BLOG_POSTS, CATEGORIES, formatDate } from '@/lib/blog-posts';
import styles from './insights.module.css';

export const metadata: Metadata = {
    title: 'Insights — Appointment Reminders, No-Show Reduction & Automation | Meetora',
    description: 'Expert guides on reducing appointment no-shows, SMS and WhatsApp reminder strategies, and automation for service businesses.',
    openGraph: {
        title: 'Insights — Meetora Blog',
        description: 'Expert guides on reducing appointment no-shows, SMS and WhatsApp reminder strategies, and automation for service businesses.',
        type: 'website',
        url: 'https://meetora.co/insights',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Insights — Meetora Blog',
        description: 'Expert guides on reducing appointment no-shows, SMS and WhatsApp reminder strategies, and automation for service businesses.',
    },
    alternates: {
        canonical: 'https://meetora.co/insights',
    },
};

const featured = BLOG_POSTS.find((p) => p.featured) ?? BLOG_POSTS[0];
const rest = BLOG_POSTS.filter((p) => p.slug !== featured.slug);

export default function InsightsPage() {
    return (
        <>
            <Navbar />
            <main style={{ paddingTop: 72, background: 'var(--bg-app)', minHeight: '100vh' }}>

                {/* ── Hero ──────────────────────────────────────────── */}
                <section className={styles.heroSection}>
                    <div className="container">
                        <p className={styles.eyebrow}>ATTENDLYX INSIGHTS</p>
                        <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.08, marginBottom: 14 }}>
                            Reduce No-Shows.<br />
                            <span className="text-gradient">Grow Your Business.</span>
                        </h1>
                        <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 540 }}>
                            Practical guides on appointment reminders, automation, and client retention for service businesses.
                        </p>
                    </div>
                </section>

                {/* ── Featured Post ──────────────────────────────────── */}
                <section style={{ padding: '56px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="container">
                        <p className={styles.eyebrow}>FEATURED</p>
                        <Link href={`/insights/${featured.slug}`} className={styles.featuredGrid}>
                            {/* Image */}
                            <div className={styles.featuredImgWrap}>
                                <Image
                                    src={featured.featuredImage.src}
                                    alt={featured.featuredImage.alt}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                    style={{ objectFit: 'cover', objectPosition: 'center' }}
                                    priority
                                />
                            </div>
                            {/* Body */}
                            <div className={styles.featuredBody}>
                                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--primary)', background: 'rgba(0, 169, 157, 0.1)', border: '1px solid rgba(0, 169, 157, 0.2)', borderRadius: 4, padding: '3px 8px', marginBottom: 16, width: 'fit-content' }}>
                                    {featured.category}
                                </span>
                                <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.5px', color: 'var(--text-primary)', marginBottom: 14 }}>
                                    {featured.title}
                                </h2>
                                <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 24 }}>
                                    {featured.excerpt}
                                </p>
                                <div className={styles.featuredMeta}>
                                    <span>{featured.author.name}</span>
                                    <span aria-hidden>·</span>
                                    <span>{formatDate(featured.publishedAt)}</span>
                                    <span aria-hidden>·</span>
                                    <span>{featured.readingTime} min read</span>
                                </div>
                            </div>
                        </Link>
                    </div>
                </section>

                {/* ── Categories + Grid ─────────────────────────────── */}
                <section style={{ padding: '56px 0 100px' }}>
                    <div className="container">
                        {/* Category pills */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 40 }}>
                            {CATEGORIES.map((cat) => (
                                <span
                                    key={cat}
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 500,
                                        padding: '6px 14px',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--border)',
                                        color: cat === 'All' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        background: cat === 'All' ? 'var(--bg-card)' : 'transparent',
                                        cursor: 'default',
                                    }}
                                >
                                    {cat}
                                </span>
                            ))}
                        </div>

                        {/* Post grid */}
                        <div className={styles.postGrid}>
                            {rest.map((post) => (
                                <Link key={post.slug} href={`/insights/${post.slug}`} className={styles.postCard}>
                                    {/* Thumbnail */}
                                    <div className={styles.postImgWrap}>
                                        <Image
                                            src={post.featuredImage.src}
                                            alt={post.featuredImage.alt}
                                            fill
                                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                            style={{ objectFit: 'cover', objectPosition: 'center' }}
                                        />
                                    </div>
                                    {/* Body */}
                                    <div className={styles.postBody}>
                                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 10, display: 'block' }}>
                                            {post.category}
                                        </span>
                                        <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: 'var(--text-primary)', marginBottom: 10, flex: 1 }}>
                                            {post.title}
                                        </h3>
                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                                            {post.excerpt.slice(0, 120)}…
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                            <span>{formatDate(post.publishedAt)}</span>
                                            <span aria-hidden>·</span>
                                            <span>{post.readingTime} min read</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

            </main>
            <Footer />
        </>
    );
}
