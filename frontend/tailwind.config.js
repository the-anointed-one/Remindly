/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/**/*.{ts,tsx}',
    ],

    screens: {
        sm:  '640px',
        md:  '768px',
        lg:  '1024px',
        xl:  '1280px',
        '2xl': '1536px',
    },

    theme: {
        extend: {
            // Design-token aliases so Tailwind utilities resolve to CSS vars
            colors: {
                app: "var(--bg-app)",
                card: "var(--bg-card)",
                surface: "var(--bg-card)",
                elevated: "var(--bg-elevated)",
                border: {
                    DEFAULT: "var(--border)",
                    light:   "var(--border-light)",
                },
                brown: "#4A2C2A",
                "brown-light": "#6B3E2E",
                orange: "#F7941D",
                "orange-light": "#FFA733",
                primary: {
                    DEFAULT: "var(--primary)",
                    hover: "var(--primary-hover)",
                },
                accent: {
                    DEFAULT: "var(--accent-cta)",
                    cta: "var(--accent-cta)",
                    hover: "var(--accent-hover)",
                    primary: "var(--accent-primary)",
                    secondary: "var(--accent-secondary)",
                },
                heading: "var(--text-heading)",
                body: "var(--text-body)",
                muted: "var(--text-muted)",
                error: "var(--color-error)",
                success: "var(--color-success)",
                warning: "var(--color-warning)",
                bg: {
                    primary:   "var(--bg-app)",
                    secondary: "var(--bg-card)",
                    card:      "var(--bg-card)",
                },
                text: {
                    primary:   "var(--text-heading)",
                    secondary: "var(--text-body)",
                    muted:     "var(--text-muted)",
                },
            },
            borderRadius: {
                sm:   'var(--radius-sm)',
                md:   'var(--radius-md)',
                lg:   'var(--radius-lg)',
                xl:   'var(--radius-xl)',
                '2xl': 'var(--radius-2xl)',
            },
            fontFamily: {
                sans: ['var(--font-main)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
        },
    },

    // Disable preflight reset — the project already has a custom global CSS baseline
    corePlugins: {
        preflight: false,
    },

    plugins: [],
};
