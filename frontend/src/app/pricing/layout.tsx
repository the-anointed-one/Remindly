import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Pricing — Meetora',
    description: 'Transparent pricing for attendance automation. 14-day free trial on all plans.',
    openGraph: {
        title: 'Pricing — Meetora',
        description: 'Transparent pricing for attendance automation. 14-day free trial on all plans.',
    },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return children;
}
