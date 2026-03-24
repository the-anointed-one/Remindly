'use client';

import { Menu } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import Icon from '@/components/ui/Icon';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faGauge,
    faGear,
    faCreditCard,
    faRightFromBracket,
    faChevronDown,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/lib/auth';
import { getInitials } from '@/lib/getInitials';

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
    firstName,
    lastName,
    email,
    profileImage,
    open,
}: {
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImage?: string;
    open: boolean;
}) {
    const initials = getInitials(
        firstName ? `${firstName} ${lastName ?? ''}`.trim() : email
    );

    return (
        <div style={{ position: 'relative', display: 'inline-flex' }}>
            {/* Outer ring — animates in when dropdown is open */}
            <motion.span
                aria-hidden
                animate={open
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.85 }
                }
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                    position: 'absolute',
                    inset: -3,
                    borderRadius: '50%',
                    border: '2px solid var(--accent-primary)',
                    pointerEvents: 'none',
                }}
            />

            {/* Avatar circle */}
            <div
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--accent-gradient)',
                    color: '#fff',
                    fontFamily: 'var(--font-main)',
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: '0.02em',
                    flexShrink: 0,
                    overflow: 'hidden',
                    userSelect: 'none',
                }}
            >
                {profileImage ? (
                    <Image
                        src={profileImage}
                        alt={initials}
                        width={36}
                        height={36}
                        style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                    />
                ) : (
                    initials
                )}
            </div>

            {/* Chevron indicator */}
            <motion.span
                aria-hidden
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: 'var(--bg-secondary)',
                    border: '1.5px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 7,
                    color: 'var(--text-muted)',
                    lineHeight: 1,
                }}
            >
                <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 7 }} />
            </motion.span>
        </div>
    );
}

// ─── Dropdown item ─────────────────────────────────────────────────────────────

function MenuItem({
    href,
    icon,
    children,
}: {
    href: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <Menu.Item>
            {({ active }) => (
                <Link
                    href={href}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 13,
                        fontWeight: 500,
                        textDecoration: 'none',
                        background: active ? 'var(--bg-secondary)' : 'transparent',
                        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                        transition: 'background var(--transition-fast), color var(--transition-fast)',
                    }}
                >
                    <span style={{ width: 14, display: 'flex', justifyContent: 'center', color: 'inherit', opacity: 0.7 }}>
                        {icon}
                    </span>
                    {children}
                </Link>
            )}
        </Menu.Item>
    );
}

// ─── UserMenu ──────────────────────────────────────────────────────────────────

export default function UserMenu() {
    const { user, logout } = useAuth();

    // ── Logged out ────────────────────────────────────────────────────────────
    if (!user) {
        return (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Link href="/login" className="btn btn-ghost btn-sm">
                    Sign In
                </Link>
                <Link href="/register" className="btn btn-primary btn-sm">
                    Sign Up
                </Link>
            </div>
        );
    }

    // ── Logged in ─────────────────────────────────────────────────────────────
    return (
        <Menu as="div" style={{ position: 'relative', display: 'inline-block' }}>
            {({ open }) => (
                <>
                    {/* Trigger */}
                    <Menu.Button
                        aria-label="Account menu"
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: 4,
                            cursor: 'pointer',
                            lineHeight: 0,
                            borderRadius: '50%',
                            outline: 'none',
                        }}
                    >
                        <Avatar
                            firstName={user.firstName}
                            lastName={user.lastName}
                            email={user.email}
                            open={open}
                        />
                    </Menu.Button>

                    {/* Dropdown */}
                    <AnimatePresence>
                        {open && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 'calc(100% + 8px)',
                                    width: 232,
                                    transformOrigin: 'top right',
                                    zIndex: 200,
                                }}
                            >
                                <Menu.Items
                                    static
                                    style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-light)',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                        borderRadius: 'var(--radius-xl)',
                                        outline: 'none',
                                        padding: 4,
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* User identity header */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '12px 12px 10px',
                                        borderBottom: '1px solid var(--border)',
                                        marginBottom: 4,
                                    }}>
                                        {/* Mini avatar */}
                                        <div style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: '50%',
                                            background: 'var(--accent-gradient)',
                                            color: '#fff',
                                            fontWeight: 700,
                                            fontSize: 11,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            {getInitials(user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user.email)}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{
                                                margin: 0,
                                                fontSize: 13,
                                                fontWeight: 600,
                                                color: 'var(--text-primary)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {user.firstName
                                                    ? `${user.firstName} ${user.lastName ?? ''}`.trim()
                                                    : 'My Account'}
                                            </p>
                                            <p style={{
                                                margin: '1px 0 0',
                                                fontSize: 11,
                                                color: 'var(--text-muted)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {user.email}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Nav items */}
                                    <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <MenuItem href="/dashboard" icon={<Icon icon={faGauge} />}>
                                            Dashboard
                                        </MenuItem>
                                        <MenuItem href="/dashboard/settings" icon={<Icon icon={faGear} />}>
                                            Account Settings
                                        </MenuItem>
                                        <MenuItem href="/dashboard/billing" icon={<Icon icon={faCreditCard} />}>
                                            Billing
                                        </MenuItem>
                                    </div>

                                    {/* Logout */}
                                    <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, padding: '4px 4px 0' }}>
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button
                                                    onClick={logout}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 10,
                                                        padding: '8px 12px',
                                                        width: '100%',
                                                        borderRadius: 'var(--radius-md)',
                                                        fontSize: 13,
                                                        fontWeight: 500,
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        background: active ? 'rgba(239,68,68,0.08)' : 'transparent',
                                                        color: active ? 'var(--error)' : 'var(--text-secondary)',
                                                        textAlign: 'left',
                                                        transition: 'background var(--transition-fast), color var(--transition-fast)',
                                                    }}
                                                >
                                                    <span style={{ width: 14, display: 'flex', justifyContent: 'center', opacity: 0.7 }}>
                                                        <Icon icon={faRightFromBracket} />
                                                    </span>
                                                    Logout
                                                </button>
                                            )}
                                        </Menu.Item>
                                    </div>
                                </Menu.Items>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </Menu>
    );
}
