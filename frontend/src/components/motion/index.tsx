'use client';

/**
 * Scroll-triggered animation primitives.
 *
 * All animations:
 *  - Trigger once when the element enters the viewport
 *  - Use GPU-composited properties only (transform + opacity)
 *  - Respect prefers-reduced-motion via useReducedMotion()
 *  - Work on mobile (IntersectionObserver-based, no scroll listeners)
 */

import { useRef, type ReactNode, type CSSProperties } from 'react';
import type React from 'react';
import {
    motion,
    useInView,
    useReducedMotion,
    type Variants,
    type Transition,
} from 'framer-motion';

// ── Shared easing + timing ────────────────────────────────────────────────────

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

const BASE_TRANSITION: Transition = {
    duration: 0.55,
    ease: EASE,
};

// ── 1. FadeIn ─────────────────────────────────────────────────────────────────
// Fades + slides up any section or block. Safe to use on any element.

interface FadeInProps {
    children: ReactNode;
    /** Vertical offset to slide from (pixels). Defaults to 28. */
    y?: number;
    /** Transition delay in seconds. */
    delay?: number;
    /** Trigger when this fraction of the element is visible. */
    amount?: number;
    /** Additional margin before the viewport edge. Use negative to trigger early. */
    margin?: string;
    className?: string;
    style?: CSSProperties;
    as?: keyof React.JSX.IntrinsicElements;
}

export function FadeIn({
    children,
    y = 28,
    delay = 0,
    amount = 0.12,
    margin = '-60px',
    className,
    style,
    as = 'div',
}: FadeInProps) {
    const ref = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const inView = useInView(ref, { once: true, amount, margin: margin as never });

    const Tag = motion[as as 'div'] ?? motion.div;

    return (
        <Tag
            ref={ref as never}
            className={className}
            style={style}
            initial={reduced ? false : { opacity: 0, y }}
            animate={inView || reduced ? { opacity: 1, y: 0 } : { opacity: 0, y }}
            transition={{ ...BASE_TRANSITION, delay }}
        >
            {children}
        </Tag>
    );
}

// ── 2. StaggerGrid ────────────────────────────────────────────────────────────
// Container that staggers its direct children into view.
// Wrap any grid/list with this, then wrap each item with StaggerItem.

const STAGGER_CONTAINER_VARIANTS: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.07,
            delayChildren: 0.05,
        },
    },
};

interface StaggerGridProps {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    /** Override stagger interval (seconds). */
    stagger?: number;
    amount?: number;
    margin?: string;
}

export function StaggerGrid({
    children,
    className,
    style,
    stagger = 0.07,
    amount = 0.08,
    margin = '-40px',
}: StaggerGridProps) {
    const ref = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const inView = useInView(ref, { once: true, amount, margin: margin as never });

    const variants: Variants = {
        hidden: {},
        visible: {
            transition: {
                staggerChildren: reduced ? 0 : stagger,
                delayChildren: 0.04,
            },
        },
    };

    return (
        <motion.div
            ref={ref}
            className={className}
            style={style}
            variants={variants}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
        >
            {children}
        </motion.div>
    );
}

// ── 3. StaggerItem ────────────────────────────────────────────────────────────
// Direct child of StaggerGrid. Slides up and fades in as its turn comes.

interface StaggerItemProps {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    /** Custom y offset. */
    y?: number;
    /** Custom duration. */
    duration?: number;
}

const ITEM_VARIANTS: Variants = {
    hidden: { opacity: 0, y: 32 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: [0.4, 0, 0.2, 1],
        },
    },
};

export function StaggerItem({
    children,
    className,
    style,
    y = 32,
    duration = 0.5,
}: StaggerItemProps) {
    const reduced = useReducedMotion();

    const variants: Variants = reduced
        ? { hidden: {}, visible: {} }
        : {
              hidden: { opacity: 0, y },
              visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration, ease: EASE },
              },
          };

    return (
        <motion.div
            className={className}
            style={{ willChange: 'transform, opacity', ...style }}
            variants={variants}
        >
            {children}
        </motion.div>
    );
}

// ── 4. SlideIn ────────────────────────────────────────────────────────────────
// Slides in from a direction — useful for flow step cards.

interface SlideInProps {
    children: ReactNode;
    direction?: 'up' | 'down' | 'left' | 'right';
    delay?: number;
    duration?: number;
    amount?: number;
    margin?: string;
    className?: string;
    style?: CSSProperties;
}

export function SlideIn({
    children,
    direction = 'up',
    delay = 0,
    duration = 0.5,
    amount = 0.15,
    margin = '-40px',
    className,
    style,
}: SlideInProps) {
    const ref = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const inView = useInView(ref, { once: true, amount, margin: margin as never });

    const offset = 36;
    const initial = reduced
        ? { opacity: 0 }
        : {
              opacity: 0,
              x: direction === 'left' ? -offset : direction === 'right' ? offset : 0,
              y: direction === 'up' ? offset : direction === 'down' ? -offset : 0,
          };

    const animate = inView || reduced
        ? { opacity: 1, x: 0, y: 0 }
        : initial;

    return (
        <motion.div
            ref={ref}
            className={className}
            style={{ willChange: 'transform, opacity', ...style }}
            initial={initial}
            animate={animate}
            transition={{ duration, ease: EASE, delay }}
        >
            {children}
        </motion.div>
    );
}
