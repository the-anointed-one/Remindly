'use client';

import { motion } from 'framer-motion';
import Icon from '@/components/ui/Icon';
import { 
    faRocket, faUsers, faCalendarAlt, faBell, 
    faEnvelope, faRobot, faChartBar, faQuestionCircle,
    faChevronRight
} from '@fortawesome/free-solid-svg-icons';

const HELP_SECTIONS = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        icon: faRocket,
        content: [
            { q: 'How does Meetora work?', a: 'Meetora helps you manage your business by organizing contacts, scheduling appointments, and automating customer communication. The typical workflow is: 1. Add Contacts, 2. Organize with Tags/Groups, 3. Create Appointments, 4. Enable Reminders, 5. Track Results.' },
            { q: 'What is a Tenant?', a: 'Meetora is a multi-tenant platform. Each business has its own isolated secure environment where all data is kept private.' }
        ]
    },
    {
        id: 'contacts',
        title: 'Contacts & Audiences',
        icon: faUsers,
        content: [
            { q: 'Tags vs Groups', a: 'Tags are labels for quick filtering (e.g., "VIP"). Groups are more formal clusters of people (e.g., "Class of 2024"). You can target both when sending campaigns.' },
            { q: 'Importing Contacts', a: 'You can upload CSV files or sync via API to bring your existing customer list into Meetora.' }
        ]
    },
    {
        id: 'appointments',
        title: 'Appointments Guide',
        icon: faCalendarAlt,
        content: [
            { q: 'What are Segment Appointments?', a: 'Segment appointments allow you to schedule a single session for an entire audience segment (e.g., all "New Leads") at once.' },
            { q: 'Managing Participants', a: 'You can track who has confirmed, rescheduled, or missed their slot directly from the appointment details.' }
        ]
    },
    {
        id: 'messaging',
        title: 'Messaging & Personalization',
        icon: faEnvelope,
        content: [
            { q: 'Dynamic Variables', a: 'Use variables like {{first_name}}, {{appointment_time}}, and {{location}} to make your messages feel personal and relevant.' },
            { q: 'Broadcast vs Campaigns', a: 'Broadcasts are one-off messages. Campaigns are automated sequences triggered by events like a new sign-up or an upcoming appointment.' }
        ]
    }
];

export default function HelpPage() {
    return (
        <div className="space-y-8">
            <header className="pb-4 border-b border-border">
                <h1 className="text-3xl font-extrabold text-heading">Help Center & Documentation</h1>
                <p className="text-muted mt-2">Everything you need to know about using Meetora effectively.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {HELP_SECTIONS.map((section) => (
                    <motion.div 
                        key={section.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm"
                    >
                        <div className="p-5 bg-primary/5 border-b border-border flex items-center gap-3">
                            <Icon icon={section.icon} className="text-primary text-xl" />
                            <h2 className="text-xl font-bold text-heading">{section.title}</h2>
                        </div>
                        <div className="p-5 space-y-6">
                            {section.content.map((item, idx) => (
                                <div key={idx} className="space-y-2">
                                    <h4 className="font-semibold text-heading flex items-start gap-2">
                                        <span className="text-primary mt-1 text-xs">•</span>
                                        {item.q}
                                    </h4>
                                    <p className="text-muted text-sm leading-relaxed pl-5">
                                        {item.a}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="bg-orange-500 rounded-xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center md:text-left">
                    <h3 className="text-2xl font-bold">Still need help?</h3>
                    <p className="opacity-90">Our technical support team is available 24/7 for Enterprise customers.</p>
                </div>
                <button className="bg-white text-orange-500 px-8 py-3 rounded-lg font-bold hover:bg-opacity-90 transition-all flex items-center gap-2">
                    Contact Support <Icon icon={faChevronRight} />
                </button>
            </div>
        </div>
    );
}
