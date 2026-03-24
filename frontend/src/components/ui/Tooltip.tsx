'use client';

/**
 * Tooltip + HelpTip
 *
 * Tooltip   — wraps any single child element; shows on hover + focus.
 * HelpTip   — a standalone (?) icon that shows a Tooltip on hover/focus.
 *             Drop it directly inside a <label> or next to any heading.
 *
 * Accessibility:
 *   - trigger receives aria-describedby pointing at the tooltip id
 *   - tooltip has role="tooltip"
 *   - keyboard: Tab to the trigger → tooltip appears; Escape or blur → hides
 *   - pointerEvents: none on the bubble so it never blocks clicks
 *
 * z-index 300 — above sidebar (50) and topbar (40).
 */

import { useState, useId, useRef, cloneElement, isValidElement, ReactElement, HTMLAttributes } from 'react';
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import Icon from './Icon';

// ── Types ────────────────────────────────────────────────────────────────────

type Placement = 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end';

interface TooltipProps {
    /** Tooltip content — plain text or JSX */
    content: React.ReactNode;
    /** The element that triggers the tooltip. Must be a single focusable element. */
    children: ReactElement<HTMLAttributes<HTMLElement>>;
    /** Where the tooltip appears relative to the trigger. Default: 'top' */
    placement?: Placement;
    /** Max width of the tooltip bubble in px. Default: 260 */
    maxWidth?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPositionStyle(placement: Placement): React.CSSProperties {
    const isTop = placement.startsWith('top');
    const isBottom = placement.startsWith('bottom');
    const isStart = placement.endsWith('start');
    const isEnd = placement.endsWith('end');
    const isCentered = !isStart && !isEnd;

    return {
        position: 'absolute',
        ...(isTop && { bottom: 'calc(100% + 9px)' }),
        ...(isBottom && { top: 'calc(100% + 9px)' }),
        ...(isCentered && { left: '50%', transform: 'translateX(-50%)' }),
        ...(isStart && { left: 0 }),
        ...(isEnd && { right: 0 }),
    };
}

function getArrowStyle(placement: Placement): React.CSSProperties {
    const isTop = placement.startsWith('top');
    const isStart = placement.endsWith('start');
    const isEnd = placement.endsWith('end');

    return {
        position: 'absolute',
        width: 8, height: 8,
        background: 'var(--tooltip-bg, #1a1a2e)',
        transform: 'rotate(45deg)',
        ...(isTop
            ? {
                bottom: -4,
                ...(isStart ? { left: 14 } : isEnd ? { right: 14 } : { left: '50%', marginLeft: -4 }),
                borderRight: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))',
                borderBottom: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))',
            }
            : {
                top: -4,
                ...(isStart ? { left: 14 } : isEnd ? { right: 14 } : { left: '50%', marginLeft: -4 }),
                borderLeft: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))',
                borderTop: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))',
            }),
    };
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

export function Tooltip({
    content,
    children,
    placement = 'top',
    maxWidth = 260,
}: TooltipProps) {
    const [visible, setVisible] = useState(false);
    const id = useId();
    const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const show = () => {
        clearTimeout(hideTimer.current);
        setVisible(true);
    };

    const hide = () => {
        // Small delay so moving the cursor from trigger → tooltip doesn't flicker
        hideTimer.current = setTimeout(() => setVisible(false), 80);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') setVisible(false);
    };

    // Inject aria-describedby onto the trigger child
    const trigger = isValidElement(children)
        ? cloneElement(children as ReactElement<HTMLAttributes<HTMLElement> & { 'aria-describedby'?: string }>, {
            'aria-describedby': visible ? id : undefined,
        })
        : children;

    return (
        <span
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
            onKeyDown={handleKeyDown}
        >
            {trigger}

            {/* Tooltip bubble — always in DOM, opacity-toggled for smooth transition */}
            <span
                id={id}
                role="tooltip"
                aria-hidden={!visible}
                style={{
                    ...getPositionStyle(placement),
                    zIndex: 300,
                    maxWidth,
                    width: 'max-content',
                    background: 'var(--tooltip-bg, #1a1a2e)',
                    border: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: 'var(--text-secondary)',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    opacity: visible ? 1 : 0,
                    transform: visible
                        ? getPositionStyle(placement).transform ?? undefined
                        : `${getPositionStyle(placement).transform ?? ''} scale(0.97)`.trim(),
                    transition: 'opacity 0.14s ease, transform 0.14s ease',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                    whiteSpace: 'normal',
                    textAlign: 'left',
                }}
            >
                {content}
                <span style={getArrowStyle(placement)} />
            </span>
        </span>
    );
}

// ── HelpTip ──────────────────────────────────────────────────────────────────

interface HelpTipProps {
    /** Tooltip text (plain string) */
    text: string;
    /** Tooltip placement. Default: 'top' */
    placement?: Placement;
    /** Max width of tooltip bubble. Default: 240 */
    maxWidth?: number;
}

/**
 * A small (?) icon that shows a tooltip on hover/focus.
 *
 * Usage — inline next to a label or heading:
 *   <h2>Reminder Settings <HelpTip text="When enabled, reminders fire automatically." /></h2>
 *   <label className="input-label">Channel <HelpTip text="..." /></label>
 */
export function HelpTip({ text, placement = 'top', maxWidth = 240 }: HelpTipProps) {
    return (
        <Tooltip content={text} placement={placement} maxWidth={maxWidth}>
            <button
                type="button"
                aria-label="Help"
                tabIndex={0}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'help',
                    padding: '1px 4px',
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    lineHeight: 1,
                    verticalAlign: 'middle',
                    borderRadius: 4,
                    transition: 'color 0.14s',
                    outline: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-accent, #60a5fa)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                onFocus={(e) => (e.currentTarget.style.color = 'var(--text-accent, #60a5fa)')}
                onBlur={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
                <Icon icon={faCircleQuestion} />
            </button>
        </Tooltip>
    );
}
