// ─────────────────────────────────────────────────────────────────────────────
//  Blog Post Data — static content for SEO-driven blogging system
// ─────────────────────────────────────────────────────────────────────────────

export type ContentBlock =
    | { type: 'paragraph'; text: string }
    | { type: 'heading'; level: 2 | 3; text: string }
    | { type: 'image'; src: string; alt: string; caption?: string }
    | { type: 'code'; language: string; code: string }
    | { type: 'cta'; headline: string; subtext: string; button: { label: string; href: string } }
    | { type: 'list'; ordered?: boolean; items: string[] }
    | { type: 'quote'; text: string; author?: string };

export interface BlogPost {
    slug: string;
    title: string;
    excerpt: string;
    category: string;
    tags: string[];
    publishedAt: string;
    updatedAt?: string;
    author: { name: string; role: string };
    featuredImage: { src: string; alt: string };
    readingTime: number;
    featured?: boolean;
    content: ContentBlock[];
}

export const CATEGORIES = [
    'All',
    'No-Show Reduction',
    'SMS & Messaging',
    'Automation',
    'Industry Guides',
    'Product',
] as const;

export type Category = (typeof CATEGORIES)[number];

// ─────────────────────────────────────────────────────────────────────────────
//  Posts
// ─────────────────────────────────────────────────────────────────────────────

export const BLOG_POSTS: BlogPost[] = [
    {
        slug: 'how-to-reduce-appointment-no-shows-by-70-percent',
        title: 'How to Reduce Appointment No-Shows by 70%: A Proven System',
        excerpt: 'No-shows cost service businesses an average of £200 per missed appointment. This guide breaks down the exact reminder sequence, timing, and channels that cut no-show rates by up to 70%.',
        category: 'No-Show Reduction',
        tags: ['no-shows', 'appointment reminders', 'SMS', 'WhatsApp'],
        publishedAt: '2026-02-18',
        author: { name: 'James Okafor', role: 'Head of Customer Success' },
        featuredImage: { src: '/images/features/reminder-workflow.jpg', alt: 'Appointment reminder workflow dashboard' },
        readingTime: 8,
        featured: true,
        content: [
            {
                type: 'paragraph',
                text: 'Appointment no-shows are one of the most costly and frustrating problems service businesses face. A missed slot cannot be recovered — the time is gone, the revenue disappears, and your schedule is thrown off. For the average clinic, salon, or coaching practice, no-shows represent between 10% and 30% of all bookings.',
            },
            {
                type: 'heading',
                level: 2,
                text: 'The Real Cost of a No-Show',
            },
            {
                type: 'paragraph',
                text: 'Before diving into solutions, it is worth understanding exactly what each missed appointment costs. Most businesses calculate this wrong — they only count the lost appointment fee. But the true cost includes: the slot that could have been filled by another client, staff idle time, administrative overhead from rescheduling, and the compounding effect on scheduling efficiency.',
            },
            {
                type: 'list',
                items: [
                    'A 60-minute appointment slot at £150/hr = £150 in lost revenue',
                    'Staff wage for that hour (still paid) = £15–£30',
                    'Admin time to follow up and reschedule = £5–£10',
                    'Opportunity cost of a client who could have filled that slot = £150',
                    'Total real cost per no-show: £320–£340',
                ],
            },
            {
                type: 'heading',
                level: 2,
                text: 'Why Clients No-Show (and What Actually Works)',
            },
            {
                type: 'paragraph',
                text: 'Research into appointment no-show behaviour consistently finds the same root causes: clients forget, life gets in the way, or they feel awkward about cancelling. The good news is that forgetting — by far the most common reason — is entirely preventable with the right reminder system.',
            },
            {
                type: 'quote',
                text: '78% of patients who missed appointments said they would have attended if they had received a reminder.',
                author: 'Journal of Primary Care & Community Health',
            },
            {
                type: 'heading',
                level: 2,
                text: 'The 3-Touch Reminder System That Works',
            },
            {
                type: 'paragraph',
                text: 'After analysing data across thousands of appointments, the highest-performing reminder systems share a common structure: three touchpoints, each serving a different psychological purpose.',
            },
            {
                type: 'list',
                ordered: true,
                items: [
                    'Touch 1 — 48 hours before: Informational reminder. "You have an appointment on [date] at [time]." This plants the appointment firmly in memory and gives clients enough time to reschedule if needed.',
                    'Touch 2 — 24 hours before: Confirmation request. "Please reply YES to confirm your appointment tomorrow." This is your conversion step — you find out who is coming.',
                    'Touch 3 — 2 hours before: Final nudge. Only sent to unconfirmed clients. "We look forward to seeing you today at [time]. Reply CANCEL if you can no longer make it."',
                ],
            },
            {
                type: 'heading',
                level: 2,
                text: 'Channel Strategy: SMS vs WhatsApp vs Voice',
            },
            {
                type: 'paragraph',
                text: 'Not all reminder channels are equal. The channel you choose determines whether your reminder gets seen, read, and acted upon. Here is how the major channels compare based on real-world data:',
            },
            {
                type: 'list',
                items: [
                    'SMS: 98% open rate, typically read within 3 minutes. Best for confirmation requests that need a quick reply.',
                    'WhatsApp: 90%+ open rate with read receipts. Higher engagement due to rich media and familiar interface. Ideal for appointment reminders in markets where WhatsApp is dominant.',
                    'Voice call: Highest anxiety trigger. Best used as a last-resort escalation for high-value appointments where a no-show would be particularly costly.',
                    'Email: Lowest open rate (20–25%) for reminders. Better suited to booking confirmations sent immediately after scheduling.',
                ],
            },
            {
                type: 'heading',
                level: 2,
                text: 'Implementing an Automated Reminder System',
            },
            {
                type: 'paragraph',
                text: 'The difference between businesses that see 70% no-show reduction and those that see 20% usually comes down to one factor: automation. Manual reminder systems fail because staff forget, get busy, or feel uncomfortable chasing clients. Automated systems run without friction.',
            },
            {
                type: 'code',
                language: 'text',
                code: `Reminder Rule Configuration Example:

Trigger: Appointment created
─────────────────────────────────
Rule 1: Send SMS 48h before
  Message: "Hi [FirstName], just a reminder about
  your [Service] with [BusinessName] on [Date] at
  [Time]. Questions? Call us on [Phone]."

Rule 2: Send WhatsApp 24h before (confirmation request)
  Message: "Hi [FirstName] — your appointment is
  tomorrow at [Time]. Reply YES to confirm or
  RESCHEDULE to change it."

Rule 3: Escalate to Voice 2h before (if no reply)
  Only fires if: no confirmation received`,
            },
            {
                type: 'heading',
                level: 2,
                text: 'Quick Wins: What to Change This Week',
            },
            {
                type: 'list',
                items: [
                    'Switch from email-only reminders to SMS or WhatsApp — this alone typically cuts no-shows by 30–40%',
                    'Add a confirmation step (YES/NO reply) to your reminders',
                    'Move your first reminder from 24h to 48h before the appointment',
                    'Set up an escalation rule: if no confirmation after 24h reminder, send a second reminder via a different channel',
                    'Enable two-way messaging so clients can reschedule without calling',
                ],
            },
            {
                type: 'cta',
                headline: 'Start Reducing No-Shows Today',
                subtext: 'Set up your automated reminder system in under 10 minutes. 14-day free trial, no credit card required.',
                button: { label: 'Start Free Trial', href: '/register' },
            },
        ],
    },
    {
        slug: 'sms-vs-whatsapp-appointment-reminders',
        title: 'SMS vs WhatsApp for Appointment Reminders: Which Performs Better in 2026?',
        excerpt: 'Both SMS and WhatsApp deliver reminders with above 90% open rates — but they work differently. This comparison breaks down confirmation rates, cost, client experience, and when to use each.',
        category: 'SMS & Messaging',
        tags: ['SMS', 'WhatsApp', 'messaging', 'comparison'],
        publishedAt: '2026-02-25',
        author: { name: 'Amara Nwosu', role: 'Product Manager' },
        featuredImage: { src: '/images/industries/industry-webinar.jpg', alt: 'SMS and WhatsApp messaging comparison' },
        readingTime: 6,
        content: [
            {
                type: 'paragraph',
                text: 'If you run a service business and you are trying to reduce appointment no-shows, you have two standout channels available: SMS and WhatsApp. Both have open rates above 90%. Both deliver messages within seconds. But they serve different client expectations and produce different results depending on how and when you use them.',
            },
            {
                type: 'heading',
                level: 2,
                text: 'Open Rates and Read Speed',
            },
            {
                type: 'paragraph',
                text: 'SMS and WhatsApp both beat email dramatically on open rates. SMS messages are opened within 3 minutes in 90% of cases. WhatsApp messages generate read receipts, giving you real confirmation that the message was seen — something SMS cannot provide. For reminder purposes, both channels are effective at getting attention.',
            },
            {
                type: 'heading',
                level: 2,
                text: 'Confirmation and Reply Rates',
            },
            {
                type: 'paragraph',
                text: 'This is where WhatsApp pulls ahead. Because WhatsApp feels like a personal messaging app, clients are more likely to engage, reply, and act. Confirmation rates for WhatsApp reminders that include a YES/NO reply option typically run 15–25% higher than equivalent SMS reminders.',
            },
            {
                type: 'list',
                items: [
                    'SMS confirmation rate: 55–65% of recipients reply',
                    'WhatsApp confirmation rate: 70–82% of recipients reply',
                    'WhatsApp two-way conversations: clients more likely to reschedule proactively vs ghosting',
                ],
            },
            {
                type: 'heading',
                level: 2,
                text: 'Cost Comparison',
            },
            {
                type: 'paragraph',
                text: 'SMS costs typically run between £0.04 and £0.08 per message depending on volume and provider. WhatsApp Business API pricing varies by country and message category — but for appointment reminders (utility messages), costs are comparable to or slightly lower than SMS in most markets. The ROI calculation is simple: if a single no-show costs your business £200+, paying £0.10 in total messaging cost to prevent it is a straightforward win.',
            },
            {
                type: 'heading',
                level: 2,
                text: 'When to Use SMS',
            },
            {
                type: 'list',
                items: [
                    'Client does not have WhatsApp or has not opted in to WhatsApp messaging',
                    'Older client demographics who are more comfortable with SMS',
                    'As a fallback channel when WhatsApp delivery fails',
                    'Short transactional messages: booking confirmations, cancellation notices',
                ],
            },
            {
                type: 'heading',
                level: 2,
                text: 'When to Use WhatsApp',
            },
            {
                type: 'list',
                items: [
                    'Clients in markets where WhatsApp is the dominant messaging app (UK, Nigeria, South Africa, most of Europe and Africa)',
                    'Longer reminder messages that benefit from formatting',
                    'Two-way conversations: rescheduling, confirmations, pre-appointment questions',
                    'When you want read receipts to trigger escalations accurately',
                ],
            },
            {
                type: 'heading',
                level: 2,
                text: 'The Best Approach: Use Both',
            },
            {
                type: 'paragraph',
                text: 'The highest-performing reminder strategies do not choose one channel — they use both strategically. Send your primary reminder via WhatsApp (higher engagement), and fall back to SMS if the WhatsApp message is not delivered or read within a set window. This failover approach maximises your coverage without increasing cost significantly.',
            },
            {
                type: 'cta',
                headline: 'Send SMS and WhatsApp Reminders From One Platform',
                subtext: 'Meetora handles multi-channel reminder delivery with automatic failover. Set it up in minutes.',
                button: { label: 'Try It Free', href: '/register' },
            },
        ],
    },
    {
        slug: 'true-cost-of-appointment-no-shows',
        title: 'The True Cost of Appointment No-Shows: What Your Business Is Really Losing',
        excerpt: 'Most businesses dramatically underestimate no-show costs by only counting lost revenue. This guide calculates the full financial impact — including hidden costs most owners overlook.',
        category: 'No-Show Reduction',
        tags: ['no-shows', 'revenue', 'business cost', 'ROI'],
        publishedAt: '2026-03-01',
        author: { name: 'James Okafor', role: 'Head of Customer Success' },
        featuredImage: { src: '/images/features/revenue-analytics.jpg', alt: 'Revenue analytics showing no-show cost impact' },
        readingTime: 5,
        content: [
            {
                type: 'paragraph',
                text: 'When business owners talk about no-shows, they usually focus on one number: the lost appointment fee. A £75 haircut that did not happen. A £120 consultation that walked out the door. But this framing dramatically understates the real financial damage, and it leads businesses to under-invest in prevention.',
            },
            {
                type: 'heading',
                level: 2,
                text: 'The Full No-Show Cost Breakdown',
            },
            {
                type: 'paragraph',
                text: 'To calculate what a no-show actually costs your business, you need to account for every downstream effect:',
            },
            {
                type: 'list',
                items: [
                    'Lost appointment revenue — the obvious one',
                    'Staff cost during the idle slot (wages still paid)',
                    'Admin time: follow-up calls, rescheduling, updating records',
                    'Overhead cost for the unused room or equipment',
                    'Opportunity cost: a client who wanted that slot and could not get it',
                    'Marketing cost attributed to acquiring that client who then did not show',
                ],
            },
            {
                type: 'heading',
                level: 2,
                text: 'A Real Numbers Example: Medical Clinic',
            },
            {
                type: 'paragraph',
                text: 'Let us take a GP clinic with 20 appointments per day, a 15% no-show rate, and a £60 average appointment value. At first glance, the no-show cost looks like this: 3 no-shows/day × £60 = £180/day.',
            },
            {
                type: 'list',
                items: [
                    'Lost revenue: 3 × £60 = £180/day',
                    'Staff idle time (GP + receptionist): 3 × 30 min × £80/hr = £120/day',
                    'Admin rescheduling overhead: 3 × 15 min × £15/hr = £11/day',
                    'Missed opportunity (unfilled slots): 3 × £60 = £180/day',
                    'Total daily cost: £491',
                    'Annual cost (240 working days): £117,840',
                ],
            },
            {
                type: 'quote',
                text: 'What looks like a £180/day problem is actually a £117,000/year problem — and it is almost entirely preventable.',
            },
            {
                type: 'heading',
                level: 2,
                text: 'The ROI of a Reminder System',
            },
            {
                type: 'paragraph',
                text: 'If an automated reminder system costs £99/month and reduces your no-show rate from 15% to 4% (a realistic outcome based on customer data), the calculation is stark:',
            },
            {
                type: 'list',
                items: [
                    'No-show reduction: from 3/day to 0.8/day',
                    'Daily saving: 2.2 fewer no-shows × £163 real cost = £359/day',
                    'Annual saving: £86,160',
                    'Annual system cost: £1,188',
                    'Net annual ROI: £84,972',
                    'Return on investment: 71× spend',
                ],
            },
            {
                type: 'cta',
                headline: 'Calculate Your No-Show Cost',
                subtext: 'See exactly how much no-shows are costing your business and how much you could save with automated reminders.',
                button: { label: 'Start Free Trial', href: '/register' },
            },
        ],
    },
    {
        slug: 'automated-appointment-reminders-setup-guide',
        title: 'Setting Up Automated Appointment Reminders: A Step-by-Step Guide',
        excerpt: 'Everything you need to configure an automated reminder system from scratch — reminder rules, message templates, confirmation flows, and escalations.',
        category: 'Automation',
        tags: ['automation', 'setup', 'reminder rules', 'configuration'],
        publishedAt: '2026-03-05',
        author: { name: 'Amara Nwosu', role: 'Product Manager' },
        featuredImage: { src: '/images/features/workflow-builder.jpg', alt: 'Reminder workflow builder interface' },
        readingTime: 7,
        content: [
            {
                type: 'paragraph',
                text: 'Setting up an automated appointment reminder system for the first time can feel overwhelming — there are reminder rules, message templates, channels, timing windows, and confirmation flows to configure. This guide walks you through every step in the order that makes sense.',
            },
            {
                type: 'heading',
                level: 2,
                text: 'Step 1: Map Your Reminder Strategy Before Touching Any Settings',
            },
            {
                type: 'paragraph',
                text: 'Before you configure anything, write down your reminder plan on paper. How many reminders do you want to send? At what intervals? Via which channels? What should happen if a client does not confirm? Having clarity here saves significant time when you are inside the platform.',
            },
            {
                type: 'list',
                items: [
                    'Decide your reminder cadence: 48h + 24h is the standard starting point',
                    'Choose your primary channel: SMS for broad reach, WhatsApp for engagement',
                    'Decide on confirmation: YES/NO reply, or one-way push?',
                    'Plan escalation: what happens if no confirmation after the first reminder?',
                ],
            },
            {
                type: 'heading',
                level: 2,
                text: 'Step 2: Write Your Message Templates',
            },
            {
                type: 'paragraph',
                text: 'Good reminder messages are short, friendly, and clear. They include the appointment time and date, a confirmation ask, and a way to reschedule. Here are proven templates to start with:',
            },
            {
                type: 'code',
                language: 'text',
                code: `48-HOUR REMINDER (SMS)
───────────────────────────────────────
Hi {{firstName}}, this is a reminder of
your {{serviceName}} with {{businessName}}
on {{appointmentDate}} at {{appointmentTime}}.

Need to reschedule? Reply RESCHEDULE or
call {{businessPhone}}.

──────────────────────────────────────

24-HOUR CONFIRMATION REQUEST (WhatsApp)
───────────────────────────────────────
Hi {{firstName}} 👋

Your {{serviceName}} appointment is
*tomorrow at {{appointmentTime}}*.

Please reply:
✅ *YES* to confirm
🔄 *RESCHEDULE* to change

See you then!
— {{businessName}}`,
            },
            {
                type: 'heading',
                level: 2,
                text: 'Step 3: Configure Your Reminder Rules',
            },
            {
                type: 'paragraph',
                text: 'A reminder rule ties together three things: a trigger (when to send relative to the appointment), a channel (SMS, WhatsApp, or voice), and a template (what to say). Rules run automatically for every appointment that matches their conditions.',
            },
            {
                type: 'list',
                ordered: true,
                items: [
                    'Create Rule 1: Trigger = 48 hours before, Channel = SMS, Template = 48h reminder',
                    'Create Rule 2: Trigger = 24 hours before, Channel = WhatsApp, Template = confirmation request',
                    'Create Rule 3: Trigger = 2 hours before, Condition = not yet confirmed, Channel = Voice, Template = final nudge',
                ],
            },
            {
                type: 'heading',
                level: 2,
                text: 'Step 4: Set Up Confirmation Handling',
            },
            {
                type: 'paragraph',
                text: 'Two-way messaging transforms reminders from one-way notifications into confirmation systems. When a client replies YES, the system marks the appointment as confirmed and stops sending additional reminders. When they reply RESCHEDULE, a rescheduling flow is triggered automatically.',
            },
            {
                type: 'heading',
                level: 2,
                text: 'Step 5: Test Before Going Live',
            },
            {
                type: 'paragraph',
                text: 'Create a test appointment for yourself with your own phone number and walk through the full reminder flow. Verify that messages arrive on time, templates populate correctly, and confirmation replies are handled as expected. A 10-minute test prevents a lot of client-facing embarrassment.',
            },
            {
                type: 'heading',
                level: 2,
                text: 'Step 6: Monitor and Optimise',
            },
            {
                type: 'paragraph',
                text: 'After your first two weeks, check your analytics: delivery rate, confirmation rate, and no-show rate. If confirmation rates are below 60%, your message templates need work — try shorter messages, a stronger call-to-action, or switching channels. If no-show rates are still above 10%, consider adding a third reminder touch.',
            },
            {
                type: 'cta',
                headline: 'Ready to Configure Your Reminder System?',
                subtext: 'Meetora walks you through setup step by step. Be live in under 10 minutes.',
                button: { label: 'Get Started Free', href: '/register' },
            },
        ],
    },
    {
        slug: 'appointment-reminders-for-medical-clinics',
        title: 'Appointment Reminders for Medical Clinics: Reducing DNA Rates in Healthcare',
        excerpt: 'Did Not Attend (DNA) rates in healthcare cost NHS and private clinics millions each year. This guide covers compliant, effective reminder strategies for medical practices.',
        category: 'Industry Guides',
        tags: ['medical', 'healthcare', 'clinic', 'DNA rates', 'patient reminders'],
        publishedAt: '2026-03-08',
        author: { name: 'James Okafor', role: 'Head of Customer Success' },
        featuredImage: { src: '/images/industries/industry-dentist.jpg', alt: 'Medical clinic appointment reminders' },
        readingTime: 6,
        content: [
            {
                type: 'paragraph',
                text: 'In healthcare, missed appointments are called DNA — Did Not Attend. They are one of the most significant operational and financial problems facing clinics and practices of every size. NHS England estimates that over 15 million GP appointments are missed every year, costing the health service approximately £1.2 billion annually. Private practices face the same problem with an even more direct financial impact.',
            },
            {
                type: 'heading',
                level: 2,
                text: 'Why Healthcare DNA Rates Are Higher',
            },
            {
                type: 'paragraph',
                text: 'Medical appointments have structurally higher no-show rates than other service categories. The lead time between booking and appointment is often longer (weeks or months), patients book when they are unwell but feel better by appointment day, and patients may feel embarrassed to cancel if their condition has improved.',
            },
            {
                type: 'heading',
                level: 2,
                text: 'Compliance Considerations for Medical Reminders',
            },
            {
                type: 'paragraph',
                text: 'Healthcare reminder systems must be designed with patient privacy in mind. In the UK, this means compliance with the UK GDPR and NHS data security standards. Key principles:',
            },
            {
                type: 'list',
                items: [
                    'Never include diagnosis, condition, or clinical information in reminder messages',
                    'Keep messages minimal: appointment time, location, and how to reschedule',
                    'Ensure patients have consented to receiving SMS or WhatsApp communications',
                    'Use opt-out mechanisms in all messages',
                    'Store messaging records securely with appropriate retention periods',
                ],
            },
            {
                type: 'heading',
                level: 2,
                text: 'Effective Message Templates for Medical Practices',
            },
            {
                type: 'code',
                language: 'text',
                code: `COMPLIANT MEDICAL REMINDER (SMS)
──────────────────────────────────────────
You have an appointment at [Practice Name]
on [Date] at [Time] with [Practitioner].

To cancel or rearrange, call [Phone Number]
or reply CANCEL to this message.

Reply STOP to opt out of reminders.
──────────────────────────────────────────

Note: Do NOT include condition, specialty
(e.g., "oncology"), or clinical details.`,
            },
            {
                type: 'heading',
                level: 2,
                text: 'DNA Rate Benchmarks by Specialty',
            },
            {
                type: 'list',
                items: [
                    'GP consultations: 6–8% DNA rate (with reminders), 15–20% without',
                    'Dental: 8–12% DNA rate without reminders, 3–5% with automated SMS',
                    'Physiotherapy: 10–15% DNA rate (higher due to long treatment courses)',
                    'Mental health: 18–25% DNA rate — highest in healthcare, reminder systems critical',
                    'Specialist outpatient: 12–17% DNA rate, often driven by long waits causing patient disengagement',
                ],
            },
            {
                type: 'heading',
                level: 2,
                text: 'Timing Reminders for Medical Appointments',
            },
            {
                type: 'paragraph',
                text: 'For appointments booked more than 7 days in advance, add an additional reminder at the 7-day mark. Research shows that for healthcare specifically, a three-touch approach (7 days, 48 hours, 2 hours) outperforms a two-touch approach by an additional 8–12% reduction in DNA rates.',
            },
            {
                type: 'cta',
                headline: 'Reduce DNA Rates in Your Practice',
                subtext: 'Meetora is used by clinics across the UK to automate compliant patient reminders. Start your free trial today.',
                button: { label: 'Start Free Trial', href: '/register' },
            },
        ],
    },
    {
        slug: 'ai-no-show-prediction-how-it-works',
        title: 'AI No-Show Prediction: How Machine Learning Identifies At-Risk Appointments',
        excerpt: 'Modern appointment systems can flag which bookings are likely to no-show before the day arrives — giving businesses time to act. Here is how the technology works and what to do with the predictions.',
        category: 'Product',
        tags: ['AI', 'machine learning', 'predictions', 'no-show risk'],
        publishedAt: '2026-03-10',
        author: { name: 'Amara Nwosu', role: 'Product Manager' },
        featuredImage: { src: '/images/features/ai-prediction.jpg', alt: 'AI no-show prediction interface' },
        readingTime: 5,
        content: [
            {
                type: 'paragraph',
                text: 'One of the most powerful recent developments in appointment management is AI-powered no-show prediction. Instead of treating every booking the same, predictive systems analyse historical patterns to identify which specific appointments carry elevated no-show risk — before the day arrives.',
            },
            {
                type: 'heading',
                level: 2,
                text: 'What Data Does No-Show Prediction Use?',
            },
            {
                type: 'paragraph',
                text: 'No-show prediction models are trained on a combination of appointment-level and client-level signals. The more historical data available, the more accurate the predictions become. Common predictive signals include:',
            },
            {
                type: 'list',
                items: [
                    'Client history: has this client missed appointments before? What was the frequency?',
                    'Lead time: how far in advance was this appointment booked? (longer lead times correlate with higher no-show rates)',
                    'Day and time: Monday mornings and Friday afternoons have higher no-show rates across most service categories',
                    'Appointment type: initial consultations no-show more than follow-ups',
                    'Confirmation status: clients who have not confirmed by 24h before are 3× more likely to no-show',
                    'Weather and local events: external factors that affect attendance',
                ],
            },
            {
                type: 'heading',
                level: 2,
                text: 'How Predictions Are Generated',
            },
            {
                type: 'paragraph',
                text: 'A classification model — typically a gradient boosting algorithm or neural network — is trained on historical appointment data with no-show labels. For each upcoming appointment, the model outputs a risk score (0–100%). Appointments above a threshold (typically 60%+ risk) are flagged for intervention.',
            },
            {
                type: 'heading',
                level: 2,
                text: 'What to Do With At-Risk Appointments',
            },
            {
                type: 'paragraph',
                text: 'Predictions are only valuable if they trigger action. When an appointment is flagged as high-risk, there are several evidence-based interventions:',
            },
            {
                type: 'list',
                ordered: true,
                items: [
                    'Send an additional reminder — high-risk clients should receive one more touchpoint than your standard reminder sequence',
                    'Switch to a higher-engagement channel — if your standard reminder is SMS, escalate to WhatsApp or voice for flagged appointments',
                    'Request explicit confirmation earlier — ask for confirmation at 72h instead of 24h for high-risk bookings',
                    'Over-book the slot conservatively — if you have reliable prediction and a waitlist, double-book high-risk slots knowing statistically one will likely cancel',
                ],
            },
            {
                type: 'heading',
                level: 2,
                text: 'Prediction Accuracy: What to Expect',
            },
            {
                type: 'paragraph',
                text: 'Well-trained no-show prediction models typically achieve 75–85% accuracy on held-out test data. In practice, this means: for every 10 appointments flagged as high-risk, 7–8 actually no-show or cancel late. False positives (flagged but they showed) are not costly — they just receive extra reminders. False negatives (not flagged but they no-show) are the ones to minimise.',
            },
            {
                type: 'cta',
                headline: 'See AI Predictions in Action',
                subtext: 'Meetora AI analyses your booking patterns and flags at-risk appointments automatically. Available on all plans.',
                button: { label: 'Start Free Trial', href: '/register' },
            },
        ],
    },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getPostBySlug(slug: string): BlogPost | undefined {
    return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getPostsByCategory(category: string): BlogPost[] {
    if (category === 'All') return BLOG_POSTS;
    return BLOG_POSTS.filter((p) => p.category === category);
}

export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
    const current = getPostBySlug(slug);
    if (!current) return BLOG_POSTS.slice(0, limit);
    return BLOG_POSTS
        .filter((p) => p.slug !== slug && p.category === current.category)
        .slice(0, limit)
        .concat(
            BLOG_POSTS
                .filter((p) => p.slug !== slug && p.category !== current.category)
                .slice(0, Math.max(0, limit - BLOG_POSTS.filter((p) => p.slug !== slug && p.category === current.category).length))
        )
        .slice(0, limit);
}

export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}
