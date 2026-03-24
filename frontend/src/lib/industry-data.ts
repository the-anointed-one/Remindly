import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faCommentSms, faPhone, faRobot, faClock, faChartBar, faCheck,
    faArrowsRotate, faCalendar, faLink, faLocationDot, faHourglass,
    faBell, faTicket, faTooth, faCut, faBullseye, faDisplay,
    faCalendarCheck,
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

export interface WorkflowStep {
    number: string;
    title: string;
    desc: string;
}

export interface Feature {
    icon: IconDefinition;
    title: string;
    desc: string;
}

export interface ROIStat {
    value: string;
    label: string;
}

export interface IndustryData {
    slug: string;
    name: string;
    icon: IconDefinition;
    color: string;
    rgbVar: string;
    meta: {
        title: string;
        description: string;
    };
    hero: {
        headline: string;
        subheading: string;
    };
    problem: {
        headline: string;
        description: string;
        painPoints: string[];
    };
    solution: {
        headline: string;
        features: Feature[];
    };
    workflow: {
        headline: string;
        steps: WorkflowStep[];
    };
    testimonial: {
        quote: string;
        name: string;
        title: string;
        result: string;
    };
    roi: {
        headline: string;
        stats: ROIStat[];
        example: string;
    };
}

const INDUSTRIES: Record<string, IndustryData> = {
    dentists: {
        slug: 'dentists',
        name: 'Dental Clinics',
        icon: faTooth,
        color: 'var(--primary)',
        rgbVar: '--primary-rgb',
        meta: {
            title: 'Appointment Reminders for Dental Clinics — Meetora',
            description: 'Reduce dental patient no-shows by up to 70% with automated SMS, voice, and WhatsApp reminders. Built for dentists and dental practices.',
        },
        hero: {
            headline: 'Never miss another patient appointment.',
            subheading: 'Automated SMS, voice calls, and WhatsApp reminders keep your chairs filled and your revenue predictable — without lifting a finger.',
        },
        problem: {
            headline: 'Empty chairs are costing your practice thousands every month.',
            description: 'Dental practices across Nigeria and Africa lose between ₦150,000 and ₦500,000 per month to patient no-shows. Patients forget. Life gets busy. And you\'re left with empty slots you can\'t fill.',
            painPoints: [
                'Patients forget appointments booked weeks in advance',
                'Last-minute cancellations with no time to fill the slot',
                'Front desk staff waste hours making reminder calls',
                'No-shows disrupt your entire day\'s schedule',
            ],
        },
        solution: {
            headline: 'Meetora keeps patients informed automatically.',
            features: [
                { icon: faCommentSms, title: 'SMS Reminders', desc: '"Hi James, your dental appointment is tomorrow at 2 PM with Dr. Osei. Reply YES to confirm." Sent automatically.' },
                { icon: faPhone, title: 'Voice Confirmation Calls', desc: 'For patients who miss texts. An automated call asks them to "Press 1 to confirm" — no staff needed.' },
                { icon: faWhatsapp, title: 'WhatsApp Reminders', desc: 'Reach patients where they actually read messages. WhatsApp open rates exceed 90%.' },
                { icon: faRobot, title: 'AI-Written Messages', desc: 'AI crafts warm, professional reminder messages that patients respond to — personalised for dentistry.' },
                { icon: faClock, title: 'Multi-Stage Timing', desc: 'Send at 48h, 24h, and 1h before the appointment. Cover every patient preference automatically.' },
                { icon: faChartBar, title: 'Confirmation Tracking', desc: 'See who confirmed, who didn\'t respond, and fill cancellations before they hurt your revenue.' },
            ],
        },
        workflow: {
            headline: 'How it works in 4 simple steps.',
            steps: [
                { number: '01', title: 'Patient books appointment', desc: 'Your reception logs the appointment as normal. Meetora picks it up automatically.' },
                { number: '02', title: 'Reminder rule triggers', desc: 'Your pre-set rule kicks in: SMS at 24h, voice call at 2h. No manual action required.' },
                { number: '03', title: 'Patient confirms instantly', desc: 'Patient replies YES via SMS or WhatsApp. You see the confirmation in real time.' },
                { number: '04', title: 'Chair stays filled', desc: 'No-shows drop. Revenue stays predictable. Your team focuses on care, not chasing patients.' },
            ],
        },
        testimonial: {
            quote: 'We reduced no-shows by 68% in the first month. The ROI was immediate — we recouped the entire annual cost in the first week alone.',
            name: 'Dr. Sarah Okonkwo',
            title: 'Dental Practice Owner, Lagos',
            result: '68% fewer no-shows',
        },
        roi: {
            headline: 'The numbers speak for themselves.',
            stats: [
                { value: '68%', label: 'Average reduction in no-shows' },
                { value: '₦320k', label: 'Average monthly revenue recovered' },
                { value: '5 min', label: 'Setup time — set once, runs forever' },
                { value: '90%+', label: 'Patient confirmation rate' },
            ],
            example: 'A dental practice with 8 appointments per day seeing just 2 no-shows daily loses roughly ₦3.84M per year. Meetora reduces that to near zero.',
        },
    },

    salons: {
        slug: 'salons',
        name: 'Salons & Spas',
        icon: faCut,
        color: '#6B3E2E',
        rgbVar: '--primary-rgb', // Fallback to orange RGB for highlights if needed, or define a brown-rgb
        meta: {
            title: 'Appointment Reminders for Salons & Spas — Meetora',
            description: 'Keep stylists fully booked. Automated SMS and WhatsApp reminders built for salons, spas, and beauty businesses.',
        },
        hero: {
            headline: 'Keep every chair in your salon booked.',
            subheading: 'Automated reminders that match your brand, reach clients on WhatsApp and SMS, and keep your stylists productive all day long.',
        },
        problem: {
            headline: 'Last-minute no-shows are killing your stylists\' income.',
            description: 'A no-show in a salon doesn\'t just cost the appointment — it costs the slot, the stylist\'s time, and the walk-in client you had to turn away. It\'s preventable.',
            painPoints: [
                'Clients book days ahead and forget by the day of',
                'No-shows mean stylists sit idle during peak hours',
                'Manual reminder calls take up front desk time',
                'Walk-in opportunities lost to confirmed but absent clients',
            ],
        },
        solution: {
            headline: 'Meetora reminds so your clients never forget.',
            features: [
                { icon: faCommentSms, title: 'Personalised SMS', desc: '"Hi Amaka, your balayage with Blessing is tomorrow at 11 AM. See you then!" Warm and on-brand.' },
                { icon: faWhatsapp, title: 'WhatsApp Reminders', desc: 'Your clients are on WhatsApp all day. Send reminders where they\'ll actually see them.' },
                { icon: faCheck, title: 'One-Tap Confirmation', desc: 'Clients reply YES to confirm. No phone calls, no back-and-forth. Your schedule updates automatically.' },
                { icon: faRobot, title: 'AI Tone Matching', desc: 'From luxury spa to urban barbershop — AI writes reminders that match your exact brand voice.' },
                { icon: faArrowsRotate, title: 'Rescheduling Flow', desc: 'Clients who can\'t make it reply RESCHEDULE. You get notified immediately to fill the slot.' },
                { icon: faCalendar, title: 'Multi-Service Scheduling', desc: 'Handle multiple services per appointment. One reminder covers everything clearly.' },
            ],
        },
        workflow: {
            headline: 'Simple for you. Delightful for your clients.',
            steps: [
                { number: '01', title: 'Client books a service', desc: 'Reception logs the appointment. Meetora automatically creates the reminder sequence.' },
                { number: '02', title: 'Branded reminder goes out', desc: 'Your client receives a warm, personalised message 24 hours before their appointment.' },
                { number: '03', title: 'Client confirms with one reply', desc: 'They reply YES on WhatsApp or SMS. Instant confirmation — no calls needed.' },
                { number: '04', title: 'Your schedule stays full', desc: 'Stylists stay productive. Revenue stays consistent. Clients feel valued.' },
            ],
        },
        testimonial: {
            quote: 'My stylists are now fully booked every single day. Clients love the WhatsApp reminders — they feel personal, not automated. Our no-show rate dropped to almost zero.',
            name: 'Amara Fashola',
            title: 'Salon Owner, Abuja',
            result: 'Near-zero no-show rate',
        },
        roi: {
            headline: 'More booked chairs. More stylist income.',
            stats: [
                { value: '72%', label: 'Drop in missed appointments' },
                { value: '₦280k', label: 'Average monthly revenue recovered' },
                { value: '3×', label: 'Higher open rate vs email' },
                { value: '14 days', label: 'Free trial — no card risk' },
            ],
            example: 'A salon with 5 stylists losing 3 appointments each per week recovers 60+ appointments per month. At ₦8,000 average per service, that\'s ₦480,000 per month recovered with Meetora.',
        },
    },

    coaches: {
        slug: 'coaches',
        name: 'Coaches & Consultants',
        icon: faBullseye,
        color: 'var(--primary)',
        rgbVar: '--primary-rgb',
        meta: {
            title: 'Session Reminders for Coaches & Consultants — Meetora',
            description: 'Stop losing income to missed coaching sessions. Automated SMS and WhatsApp reminders keep clients on time and your calendar full.',
        },
        hero: {
            headline: 'Stop losing income to missed coaching sessions.',
            subheading: 'Meetora automatically reminds clients before every call, workshop, and follow-up — so you can focus on coaching, not chasing.',
        },
        problem: {
            headline: 'No-shows don\'t just waste time — they cut your income directly.',
            description: 'For coaches and consultants, every no-show is money lost with no recovery. Clients get busy, forget, or lose track of Zoom links. The cost compounds fast.',
            painPoints: [
                'Clients book weeks ahead and forget the session',
                'No-show means that slot is gone — you can\'t rebook it',
                'Chasing clients for confirmation wastes billable time',
                'Inconsistent attendance disrupts client progress and your earnings',
            ],
        },
        solution: {
            headline: 'Automated reminders that keep clients accountable.',
            features: [
                { icon: faCommentSms, title: 'Session Reminders', desc: '"Hi Chidi, your coaching call with me is tomorrow at 10 AM. Your Zoom link: [link]. See you then!" Fully automated.' },
                { icon: faWhatsapp, title: 'WhatsApp Delivery', desc: 'Clients read WhatsApp. Reminders land where they\'ll actually see them before the session.' },
                { icon: faLink, title: 'Zoom / Meet Links Included', desc: 'Embed session links directly in your reminder message. Clients are one tap away from joining.' },
                { icon: faRobot, title: 'AI-Crafted Messages', desc: 'Reminders that feel like you wrote them personally — not a generic automated blast.' },
                { icon: faClock, title: 'Timed Sequences', desc: '24h reminder, then a 30-minute heads-up. Two touches ensure nobody forgets.' },
                { icon: faChartBar, title: 'Attendance Insights', desc: 'Track who consistently misses and proactively address it. Protect your time and revenue.' },
            ],
        },
        workflow: {
            headline: 'Set it once. Never chase a client again.',
            steps: [
                { number: '01', title: 'Log the coaching session', desc: 'Add the appointment with client details. Meetora automatically sets the reminder sequence.' },
                { number: '02', title: 'Reminder fires automatically', desc: '24 hours before and 30 minutes before: client gets a personalised message with the session link.' },
                { number: '03', title: 'Client confirms attendance', desc: 'One-tap reply via SMS or WhatsApp. You know instantly who\'s coming.' },
                { number: '04', title: 'Sessions happen on time', desc: 'More completed sessions = faster client results + consistent revenue for you.' },
            ],
        },
        testimonial: {
            quote: 'I used to lose 2–3 sessions per week to no-shows. Now it\'s almost zero. Meetora paid for itself in the first session it saved.',
            name: 'Chidi Eze',
            title: 'Business Coach, Lagos',
            result: 'Went from 3 no-shows/week to near zero',
        },
        roi: {
            headline: 'Every saved session is direct revenue.',
            stats: [
                { value: '3×', label: 'Fewer missed coaching sessions' },
                { value: '₦450k', label: 'Average monthly income protected' },
                { value: '95%', label: 'Confirmation rate with reminders' },
                { value: '5 min', label: 'Setup time per reminder rule' },
            ],
            example: 'A coach charging ₦30,000 per session who loses 3 sessions weekly loses ₦360,000/month. Meetora reduces that to near zero — for less than ₦20,000/month.',
        },
    },

    webinars: {
        slug: 'webinars',
        name: 'Webinars & Online Courses',
        icon: faDisplay,
        color: 'var(--primary)',
        rgbVar: '--primary-rgb',
        meta: {
            title: 'Webinar Attendance Reminders — Meetora',
            description: 'Turn registrations into real attendees. Automated SMS and WhatsApp reminders that maximise webinar and online course attendance.',
        },
        hero: {
            headline: 'Turn every registration into a real attendee.',
            subheading: 'Most webinars lose 60% of registrants to no-shows. Meetora sends perfectly timed SMS and WhatsApp reminders that bring them back.',
        },
        problem: {
            headline: 'You filled the registration page. Now fill the actual room.',
            description: 'The average webinar attendance rate is just 35–40% of registrations. Registrants sign up with good intentions but forget by the day. You built the content — make sure people see it.',
            painPoints: [
                'Registrants forget within days of signing up',
                'Email reminders are ignored with <20% open rates',
                'Low attendance hurts your conversion and ROI on the event',
                'No way to know who\'s actually coming until it\'s too late',
            ],
        },
        solution: {
            headline: 'Remind them where they actually pay attention.',
            features: [
                { icon: faCommentSms, title: 'Registration Confirmation SMS', desc: '"You\'re registered! Your webinar on [Topic] is on [Date] at [Time]. Zoom link: [link]." Sent immediately on signup.' },
                { icon: faWhatsapp, title: 'WhatsApp Countdown Reminders', desc: 'WhatsApp open rates exceed 90%. Your webinar stays top of mind from registration to showtime.' },
                { icon: faLink, title: 'Join Links in Every Message', desc: 'No hunting for the link. Every reminder includes the direct Zoom / Meet / YouTube link.' },
                { icon: faClock, title: 'Multi-Stage Sequence', desc: '7 days before, 1 day before, 1 hour before, and 10 minutes before. Maximum attendance.' },
                { icon: faRobot, title: 'AI-Personalised Messages', desc: 'Messages that feel personal — not mass-broadcast. Higher open and click-through rates.' },
                { icon: faChartBar, title: 'Attendance Tracking', desc: 'See reminder delivery and confirmation rates in real time. Know your expected attendance before you go live.' },
            ],
        },
        workflow: {
            headline: 'From registration to live room — automatically.',
            steps: [
                { number: '01', title: 'Attendee registers', desc: 'They sign up on your page. Meetora captures the registration and starts the reminder sequence.' },
                { number: '02', title: 'Confirmation + link sent instantly', desc: 'An immediate SMS or WhatsApp with the join link locks in the commitment.' },
                { number: '03', title: 'Countdown reminders fire', desc: '7 days, 1 day, 1 hour — each message rebuilds excitement and provides the link.' },
                { number: '04', title: 'More people show up live', desc: 'Attendance rates double. More live attendees = more sales, more engagement, better ROI.' },
            ],
        },
        testimonial: {
            quote: 'Our webinar attendance rate went from 35% to 78% after switching to Meetora. Our last launch generated 2× more sales just because more people showed up live.',
            name: 'Fatima Adeyemi',
            title: 'Online Course Creator, Accra',
            result: '78% attendance rate vs 35% before',
        },
        roi: {
            headline: 'More attendees. More conversions. More revenue.',
            stats: [
                { value: '2×', label: 'Average increase in live attendance' },
                { value: '78%', label: 'Attendance rate with Meetora' },
                { value: '90%+', label: 'WhatsApp reminder open rate' },
                { value: '10 min', label: 'Time to set up your first sequence' },
            ],
            example: 'A webinar with 500 registrants typically gets 175 attendees. With Meetora, you\'ll see 350–400. At even a 10% conversion to a ₦50,000 offer, that\'s an extra ₦8.75M per webinar.',
        },
    },

    events: {
        slug: 'events',
        name: 'Event Organizers',
        icon: faCalendarCheck,
        color: '#4A2C2A',
        rgbVar: '--primary-rgb',
        meta: {
            title: 'Event Attendance Reminders — Meetora',
            description: 'Fill every seat at your next event. Automated SMS and WhatsApp reminders with countdown sequences, venue details, and last-minute alerts.',
        },
        hero: {
            headline: 'Fill every seat at your next event.',
            subheading: 'Keep attendees informed, excited, and showing up. Automated countdown reminders, venue details, and last-minute updates — sent without manual effort.',
        },
        problem: {
            headline: 'Sold tickets don\'t guarantee full rooms.',
            description: 'Event organisers regularly see 25–40% of ticket holders not show up on the day. People buy with excitement but forget between purchase and event. Your speakers, sponsors, and reputation depend on a full room.',
            painPoints: [
                'Ticket buyers forget between purchase date and event day',
                'No clear way to communicate logistics and updates at scale',
                'Last-minute venue changes take too long to communicate',
                'A half-empty room damages the energy and sponsor perception',
            ],
        },
        solution: {
            headline: 'Keep your audience informed from registration to doors open.',
            features: [
                { icon: faLocationDot, title: 'Venue & Logistics Updates', desc: '"Your event at [Venue] starts at 10 AM tomorrow. Parking is available on Level 2. See you there!" Automated and timely.' },
                { icon: faHourglass, title: 'Countdown Sequence', desc: '7 days, 3 days, 1 day, 2 hours — a full countdown that builds excitement and keeps your event top of mind.' },
                { icon: faBell, title: 'Instant Blast Alerts', desc: 'Speaker change? Venue update? Send an SMS blast to all confirmed attendees in seconds — no email delays.' },
                { icon: faWhatsapp, title: 'WhatsApp Reminders', desc: 'The most-read channel for event updates. Attendees see it immediately, unlike email buried in inboxes.' },
                { icon: faTicket, title: 'Ticket Confirmation', desc: 'Send a confirmation SMS the moment they register. Reduces chargebacks and buyer\'s remorse.' },
                { icon: faChartBar, title: 'Attendance Forecasting', desc: 'See confirmation rates before the event day. Know how many to expect and plan accordingly.' },
            ],
        },
        workflow: {
            headline: 'Every attendee, every update — automated.',
            steps: [
                { number: '01', title: 'Attendee registers or buys a ticket', desc: 'Meetora picks up the registration and starts the countdown reminder sequence automatically.' },
                { number: '02', title: 'Countdown reminders go out', desc: '7 days, 3 days, 1 day, and 2 hours — excitement builds, logistics delivered, link to venue included.' },
                { number: '03', title: 'Attendees confirm attendance', desc: 'One-tap reply lets you know who\'s confirmed. You see real-time attendance projections.' },
                { number: '04', title: 'Full room. Great energy. Happy sponsors.', desc: 'Higher attendance = better atmosphere, more sponsor value, and stronger future ticket sales.' },
            ],
        },
        testimonial: {
            quote: 'We went from 60% to 94% actual attendance at our last conference. The venue was buzzing. Our sponsors were thrilled. We\'re never running an event without Meetora again.',
            name: 'Emmanuel Osei',
            title: 'Event Organizer, Nairobi',
            result: '60% → 94% attendance rate',
        },
        roi: {
            headline: 'More seats filled. Better ROI on every event.',
            stats: [
                { value: '94%', label: 'Attendance rate with Meetora' },
                { value: '3×', label: 'Faster logistics communication' },
                { value: '40%', label: 'Reduction in day-of no-shows' },
                { value: '₦0', label: 'Extra cost to fill the room' },
            ],
            example: 'A 200-person conference at 60% attendance has 80 empty seats. At 94% attendance, just 12 seats are empty. Meetora puts more bodies in the room.',
        },
    },
};

export function getIndustryData(slug: string): IndustryData | null {
    return INDUSTRIES[slug] ?? null;
}

export function getAllIndustrySlugs(): string[] {
    return Object.keys(INDUSTRIES);
}
