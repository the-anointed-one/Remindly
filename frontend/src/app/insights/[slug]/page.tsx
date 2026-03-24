import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import {
    BLOG_POSTS,
    getPostBySlug,
    getRelatedPosts,
    formatDate,
    type ContentBlock,
} from '@/lib/blog-posts';
import styles from '../insights.module.css';

// ── Static generation ─────────────────────────────────────────────────────────

export function generateStaticParams() {
    return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

// ── SEO metadata ──────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const post = getPostBySlug(slug);
    if (!post) return {};

    const url = `https://meetora.co/insights/${post.slug}`;

    return {
        title: `${post.title} | Meetora Insights`,
        description: post.excerpt,
        openGraph: {
            title: post.title,
            description: post.excerpt,
            type: 'article',
            url,
            publishedTime: post.publishedAt,
            modifiedTime: post.updatedAt ?? post.publishedAt,
            authors: [post.author.name],
            images: [
                {
                    url: `https://meetora.co${post.featuredImage.src}`,
                    alt: post.featuredImage.alt,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: post.title,
            description: post.excerpt,
            images: [`https://meetora.co${post.featuredImage.src}`],
        },
        alternates: {
            canonical: url,
        },
    };
}

// ── Content block renderer ────────────────────────────────────────────────────

function renderBlock(block: ContentBlock, i: number) {
    switch (block.type) {
        case 'paragraph':
            return (
                <p key={i} style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 24 }}>
                    {block.text}
                </p>
            );

        case 'heading':
            if (block.level === 2) {
                return (
                    <h2 key={i} style={{ fontSize: 'clamp(20px, 2.5vw, 26px)', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.25, color: 'var(--text-primary)', marginTop: 48, marginBottom: 16 }}>
                        {block.text}
                    </h2>
                );
            }
            return (
                <h3 key={i} style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)', marginTop: 32, marginBottom: 12 }}>
                    {block.text}
                </h3>
            );

        case 'list':
            return (
                <ul key={i} style={{ margin: '0 0 24px', paddingLeft: 0, listStyle: 'none' }}>
                    {block.items.map((item, j) => (
                        <li
                            key={j}
                            style={{
                                display: 'flex',
                                gap: 12,
                                fontSize: 15,
                                lineHeight: 1.7,
                                color: 'var(--text-secondary)',
                                marginBottom: 10,
                                paddingLeft: 4,
                            }}
                        >
                            <span style={{
                                flexShrink: 0,
                                marginTop: 6,
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: block.ordered ? 'var(--primary)' : 'var(--text-muted)',
                                display: 'block',
                            }} />
                            {block.ordered
                                ? <span><strong style={{ color: 'var(--text-primary)' }}>{j + 1}.</strong> {item}</span>
                                : <span>{item}</span>
                            }
                        </li>
                    ))}
                </ul>
            );

        case 'quote':
            return (
                <blockquote
                    key={i}
                    style={{
                        margin: '32px 0',
                        padding: '20px 24px',
                        borderLeft: '3px solid var(--primary)',
                        background: 'rgba(0, 169, 157, 0.06)',
                        borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                    }}
                >
                    <p style={{ fontSize: 17, lineHeight: 1.7, fontStyle: 'italic', color: 'var(--text-primary)', margin: 0, marginBottom: block.author ? 10 : 0 }}>
                        &ldquo;{block.text}&rdquo;
                    </p>
                    {block.author && (
                        <cite style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'normal' }}>
                            — {block.author}
                        </cite>
                    )}
                </blockquote>
            );

        case 'code':
            return (
                <div key={i} style={{ margin: '24px 0 32px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {block.language}
                        </span>
                    </div>
                    <pre style={{
                        margin: 0,
                        padding: '20px',
                        background: '#0d1117',
                        overflowX: 'auto',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 13,
                        lineHeight: 1.65,
                        color: '#e6edf3',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                    }}>
                        <code>{block.code}</code>
                    </pre>
                </div>
            );

        case 'image':
            return (
                <figure key={i} style={{ margin: '32px 0' }}>
                    <div style={{ position: 'relative', height: 'clamp(220px, 40vw, 400px)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <Image
                            src={block.src}
                            alt={block.alt}
                            fill
                            sizes="(max-width: 900px) 100vw, 720px"
                            style={{ objectFit: 'cover', objectPosition: 'center' }}
                        />
                    </div>
                    {block.caption && (
                        <figcaption style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                            {block.caption}
                        </figcaption>
                    )}
                </figure>
            );

        case 'cta':
            return (
                <div key={i} className={styles.ctaBlock}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(0, 169, 157, 0.08) 0%, transparent 65%)', pointerEvents: 'none' }} aria-hidden />
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, position: 'relative' }}>
                        {block.headline}
                    </h3>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, position: 'relative' }}>
                        {block.subtext}
                    </p>
                    <Link
                        href={block.button.href}
                        className="btn btn-lg"
                        style={{ background: 'var(--primary)', color: '#fff', position: 'relative' }}
                    >
                        {block.button.label}
                    </Link>
                </div>
            );

        default:
            return null;
    }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const post = getPostBySlug(slug);
    if (!post) notFound();

    const related = getRelatedPosts(slug, 3);
    const url = `https://meetora.co/insights/${post.slug}`;

    // JSON-LD structured data
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.excerpt,
        image: `https://meetora.co${post.featuredImage.src}`,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt ?? post.publishedAt,
        author: {
            '@type': 'Person',
            name: post.author.name,
            jobTitle: post.author.role,
        },
        publisher: {
            '@type': 'Organization',
            name: 'Meetora',
            url: 'https://meetora.co',
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        articleSection: post.category,
        keywords: post.tags.join(', '),
        wordCount: post.content.reduce((acc, b) => acc + (b.type === 'paragraph' ? (b as { text: string }).text.split(' ').length : 0), 0),
        timeRequired: `PT${post.readingTime}M`,
    };

    return (
        <>
            <Navbar />

            {/* JSON-LD */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <main style={{ paddingTop: 72, background: 'var(--bg-app)', minHeight: '100vh' }}>

                {/* ── Hero image ────────────────────────────────────── */}
                <div style={{ position: 'relative', height: 'clamp(280px, 40vw, 480px)', overflow: 'hidden', borderBottom: '1px solid var(--border)' }}>
                    <Image
                        src={post.featuredImage.src}
                        alt={post.featuredImage.alt}
                        fill
                        priority
                        sizes="100vw"
                        style={{ objectFit: 'cover', objectPosition: 'center' }}
                    />
                    {/* Gradient overlay */}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(18,18,26,0.96) 0%, rgba(18,18,26,0.55) 55%, rgba(18,18,26,0.2) 100%)' }} aria-hidden />
                    {/* Hero content */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end' }}>
                        <div className="container" style={{ paddingBottom: 36 }}>
                            <Link
                                href="/insights"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 14, textDecoration: 'none' }}
                            >
                                ← All Insights
                            </Link>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff', background: 'var(--primary)', opacity: 0.9, borderRadius: 4, padding: '3px 8px' }}>
                                    {post.category}
                                </span>
                                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{post.readingTime} min read</span>
                            </div>
                            <h1 style={{ fontSize: 'clamp(20px, 3.5vw, 40px)', fontWeight: 900, lineHeight: 1.12, letterSpacing: '-1px', color: '#ffffff', maxWidth: 760, margin: '0 0 14px', textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
                                {post.title}
                            </h1>
                            <div className={styles.heroMeta}>
                                <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{post.author.name}</span>
                                <span aria-hidden>·</span>
                                <span>{post.author.role}</span>
                                <span aria-hidden>·</span>
                                <span>{formatDate(post.publishedAt)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Article body + sidebar ─────────────────────────── */}
                {/* Desktop: article (1fr) | sidebar (300px) */}
                {/* Mobile: article stacked above sidebar */}
                <div className={styles.contentGrid}>

                    {/* ── Article ── */}
                    <article>
                        <p style={{ fontSize: 17, lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 32, borderBottom: '1px solid var(--border)', paddingBottom: 32, fontStyle: 'italic' }}>
                            {post.excerpt}
                        </p>
                        {post.content.map((block, i) => renderBlock(block, i))}

                        {/* Tags */}
                        <div style={{ marginTop: 48, paddingTop: 32, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {post.tags.map((tag) => (
                                <span key={tag} style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', background: 'var(--bg-card)' }}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </article>

                    {/* ── Sidebar ── */}
                    <aside style={{ paddingTop: 4 }}>
                        {/* Author card */}
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: 24 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>WRITTEN BY</p>
                            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{post.author.name}</p>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{post.author.role}, Meetora</p>
                        </div>

                        {/* CTA box */}
                        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(0, 169, 157, 0.2)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: 24, textAlign: 'center' }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Ready to cut no-shows?</p>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>14-day free trial. No credit card required.</p>
                            <Link href="/register" className="btn btn-primary btn-sm" style={{ display: 'block', textAlign: 'center' }}>
                                Start Free Trial
                            </Link>
                        </div>

                        {/* Related posts */}
                        {related.length > 0 && (
                            <div>
                                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>RELATED ARTICLES</p>
                                {related.map((rp) => (
                                    <Link key={rp.slug} href={`/insights/${rp.slug}`} style={{ display: 'block', textDecoration: 'none', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 4 }}>{rp.title}</p>
                                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rp.readingTime} min read</p>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </aside>
                </div>

            </main>
            <Footer />
        </>
    );
}
