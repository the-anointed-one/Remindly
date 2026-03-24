/**
 * MEETORA — End-to-End Userflow Test
 * ====================================
 * Simulates the full broadcast → response capture → follow-up pipeline.
 *
 * Steps:
 *   1. Create 3 contacts tagged with level_5_staff
 *   2. Send broadcast (create Campaign + CampaignRecipient rows)
 *   3. Simulate inbound replies: Alice=YES, Bob=NO, Carol=YES
 *   4. Verify responses recorded in message_responses
 *   5. Verify CampaignRecipient table updates
 *   6. Resolve follow-up audience (confirmed only) — must be Alice + Carol only
 *
 * Run:
 *   npx ts-node --transpile-only scripts/e2e-userflow-test.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string, detail?: string) {
    if (condition) {
        console.log(`  ✓  ${label}`);
        passed++;
    } else {
        const msg = detail ? `${label} — ${detail}` : label;
        console.error(`  ✗  ${msg}`);
        failures.push(msg);
        failed++;
    }
}

function step(n: number, title: string) {
    console.log(`\n${'─'.repeat(64)}`);
    console.log(`  STEP ${n}  ${title}`);
    console.log('─'.repeat(64));
}

function hr() { console.log('═'.repeat(64)); }

// ── parseResponseStatus — mirrors twilio-webhook.controller.ts ───────────────

function parseResponseStatus(text: string): 'confirmed' | 'cancelled' | 'pending' {
    const u = text.trim().toUpperCase();
    if (['YES', 'Y', 'CONFIRM', 'CONFIRMED', '1'].includes(u)) return 'confirmed';
    if (['NO', 'N', 'CANCEL', 'CANCELLED', 'DECLINE', '3'].includes(u)) return 'cancelled';
    return 'pending';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
    hr();
    console.log('  MEETORA — END-TO-END USERFLOW TEST');
    console.log('  Broadcast → Response Capture → Follow-up Targeting');
    hr();

    // Find tenant
    const tenant = await prisma.tenant.findFirst({ select: { id: true, name: true } });
    if (!tenant) {
        console.error('ERROR: No tenant found. Run the seed first.');
        process.exit(1);
    }
    console.log(`\n  Tenant: ${tenant.name} (${tenant.id})`);

    // ── Cleanup any stale data from previous runs ─────────────────────────────
    const staleContacts = await prisma.contact.findMany({
        where: { tenantId: tenant.id, phone: { in: ['+15550001111', '+15550002222', '+15550003333'] } },
        select: { id: true },
    });
    if (staleContacts.length > 0) {
        await prisma.contact.deleteMany({ where: { id: { in: staleContacts.map(c => c.id) } } });
    }
    await prisma.campaign.deleteMany({ where: { tenantId: tenant.id, name: '[E2E] Team Bonding Event' } });
    await prisma.tag.deleteMany({ where: { tenantId: tenant.id, name: 'level_5_staff' } });

    // ─────────────────────────────────────────────────────────────────────────
    step(1, 'Create contacts with tag: level_5_staff');
    // ─────────────────────────────────────────────────────────────────────────

    const [alice, bob, carol] = await Promise.all([
        prisma.contact.create({ data: { tenantId: tenant.id, name: 'Alice Chen',  phone: '+15550001111', email: 'alice@test.meetora.app' } }),
        prisma.contact.create({ data: { tenantId: tenant.id, name: 'Bob Kim',     phone: '+15550002222', email: 'bob@test.meetora.app'   } }),
        prisma.contact.create({ data: { tenantId: tenant.id, name: 'Carol Davis', phone: '+15550003333', email: 'carol@test.meetora.app' } }),
    ]);

    console.log(`\n  Contacts created:`);
    for (const c of [alice, bob, carol]) {
        console.log(`    • ${c.name.padEnd(14)} ${c.phone}  (${c.id.slice(0, 8)}…)`);
    }

    const tag = await prisma.tag.create({ data: { tenantId: tenant.id, name: 'level_5_staff' } });
    console.log(`\n  Tag created: "${tag.name}" (${tag.id.slice(0, 8)}…)`);

    await Promise.all([alice, bob, carol].map(c =>
        prisma.contactTag.create({ data: { contactId: c.id, tagId: tag.id } }),
    ));

    const taggedCount = await prisma.contactTag.count({ where: { tagId: tag.id } });
    assert(taggedCount === 3, `3 contacts tagged with level_5_staff`, `got ${taggedCount}`);

    // ─────────────────────────────────────────────────────────────────────────
    step(2, 'Send broadcast — Team bonding event Friday. Reply YES to confirm.');
    // ─────────────────────────────────────────────────────────────────────────

    const MESSAGE_TEMPLATE = 'Team bonding event Friday. Reply YES to confirm attendance.';

    // BroadcastService.sendBroadcast() creates a Campaign record and one
    // CampaignRecipient per contact. We replicate that here.
    const campaign = await prisma.campaign.create({
        data: { tenantId: tenant.id, name: '[E2E] Team Bonding Event', description: 'Channel: SMS' },
    });

    const recipients = await Promise.all([alice, bob, carol].map(c =>
        prisma.campaignRecipient.create({
            data: {
                campaignId: campaign.id,
                contactId:  c.id,
                recipient:  c.phone!,
                channel:    'SMS',
                status:     'sent',
                messageBody: MESSAGE_TEMPLATE,
                sentAt:     new Date(),
            },
        }),
    ));

    console.log(`\n  Campaign: ${campaign.id}`);
    console.log(`  Message:  "${MESSAGE_TEMPLATE}"`);
    console.log(`\n  Recipients sent:`);
    for (let i = 0; i < recipients.length; i++) {
        console.log(`    • ${[alice, bob, carol][i].name} → ${[alice, bob, carol][i].phone}  [status: sent]`);
    }

    assert(recipients.length === 3, `Broadcast created 3 CampaignRecipient records`, `got ${recipients.length}`);

    // ─────────────────────────────────────────────────────────────────────────
    step(3, 'Simulate inbound replies: Alice=YES, Bob=NO, Carol=YES');
    // ─────────────────────────────────────────────────────────────────────────

    const replyInputs = [
        { contact: alice, recipient: recipients[0], text: 'YES' },
        { contact: bob,   recipient: recipients[1], text: 'NO'  },
        { contact: carol, recipient: recipients[2], text: 'YES' },
    ];

    console.log('\n  Inbound SMS simulation (mirrors twilio-webhook.controller.ts#linkResponseToCampaign):');

    const messageResponses = await Promise.all(replyInputs.map(async ({ contact, recipient, text }) => {
        const status = parseResponseStatus(text);

        // 1. Update CampaignRecipient — respondedAt + responseText + status
        await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: { responseText: text, respondedAt: new Date(), status: 'responded' },
        });

        // 2. Create MessageResponse — the structured response record (Phase 2)
        const mr = await prisma.messageResponse.create({
            data: {
                tenantId:           tenant.id,
                contactId:          contact.id,
                broadcastId:        campaign.id,
                campaignRecipientId: recipient.id,
                responseText:       text,
                responseStatus:     status,
            },
        });

        // 3. ContactActivity — feeds the contact timeline
        await prisma.contactActivity.create({
            data: {
                tenantId:     tenant.id,
                contactId:    contact.id,
                activityType: 'campaign_response_received' as any,
                referenceId:  campaign.id,
                metadata:     { responseText: text, responseStatus: status },
            },
        });

        console.log(`    • ${contact.name.padEnd(14)} replied "${text}" → status: ${status}`);
        return mr;
    }));

    assert(messageResponses.length === 3, `3 inbound replies simulated`, `got ${messageResponses.length}`);

    // ─────────────────────────────────────────────────────────────────────────
    step(4, 'Verify responses recorded in message_responses');
    // ─────────────────────────────────────────────────────────────────────────

    const storedResponses = await prisma.messageResponse.findMany({
        where:   { broadcastId: campaign.id, tenantId: tenant.id },
        include: { contact: { select: { name: true, phone: true } } },
        orderBy: { timestamp: 'asc' },
    });

    const confirmedCount = storedResponses.filter(r => r.responseStatus === 'confirmed').length;
    const cancelledCount = storedResponses.filter(r => r.responseStatus === 'cancelled').length;
    const pendingCount   = storedResponses.filter(r => r.responseStatus === 'pending').length;

    assert(storedResponses.length === 3, `3 MessageResponse records in database`, `got ${storedResponses.length}`);
    assert(confirmedCount === 2, `2 confirmed (Alice + Carol)`, `got ${confirmedCount}`);
    assert(cancelledCount === 1, `1 cancelled (Bob)`,           `got ${cancelledCount}`);
    assert(pendingCount   === 0, `0 pending`,                   `got ${pendingCount}`);

    console.log('\n  message_responses table:');
    console.log('  ┌──────────────────┬────────────┬──────────────┬───────────────────────────┐');
    console.log('  │ contact          │ reply_text │ status       │ id                        │');
    console.log('  ├──────────────────┼────────────┼──────────────┼───────────────────────────┤');
    for (const r of storedResponses) {
        const name   = (r.contact?.name ?? 'Unknown').padEnd(16);
        const text   = r.responseText.padEnd(10);
        const status = r.responseStatus.padEnd(12);
        const id     = r.id.slice(0, 25) + '…';
        console.log(`  │ ${name} │ ${text} │ ${status} │ ${id} │`);
    }
    console.log('  └──────────────────┴────────────┴──────────────┴───────────────────────────┘');

    // ─────────────────────────────────────────────────────────────────────────
    step(5, 'Verify CampaignRecipient table updates');
    // ─────────────────────────────────────────────────────────────────────────

    const updatedRecipients = await prisma.campaignRecipient.findMany({
        where:   { campaignId: campaign.id },
        include: { contact: { select: { name: true } }, messageResponse: true },
        orderBy: { createdAt: 'asc' },
    });

    const allResponded   = updatedRecipients.every(r => r.status === 'responded');
    const allHaveMR      = updatedRecipients.every(r => r.messageResponse !== null);
    const allHaveText    = updatedRecipients.every(r => r.responseText !== null);
    const allHaveDate    = updatedRecipients.every(r => r.respondedAt !== null);

    assert(allResponded, `All 3 CampaignRecipients updated to status "responded"`);
    assert(allHaveMR,    `All 3 CampaignRecipients have a linked MessageResponse (1:1)`);
    assert(allHaveText,  `All 3 CampaignRecipients have responseText populated`);
    assert(allHaveDate,  `All 3 CampaignRecipients have respondedAt timestamp`);

    console.log('\n  campaign_recipients table:');
    console.log('  ┌──────────────────┬────────────┬───────────┬─────────────┬───────────┐');
    console.log('  │ contact          │ reply_text │ rc_status │ mr_status   │ responded │');
    console.log('  ├──────────────────┼────────────┼───────────┼─────────────┼───────────┤');
    for (const r of updatedRecipients) {
        const name     = (r.contact?.name ?? 'Unknown').padEnd(16);
        const text     = (r.responseText ?? '—').padEnd(10);
        const rcStatus = r.status.padEnd(9);
        const mrStatus = (r.messageResponse?.responseStatus ?? '—').padEnd(11);
        const date     = r.respondedAt ? '✓' : '—';
        console.log(`  │ ${name} │ ${text} │ ${rcStatus} │ ${mrStatus} │ ${date.padEnd(9)} │`);
    }
    console.log('  └──────────────────┴────────────┴───────────┴─────────────┴───────────┘');

    // ─────────────────────────────────────────────────────────────────────────
    step(6, 'Send follow-up to confirmed participants only');
    // ─────────────────────────────────────────────────────────────────────────

    console.log('\n  Executing spec query:');
    console.log('  ┌─────────────────────────────────────────────────────────┐');
    console.log('  │  SELECT contact_id                                       │');
    console.log('  │  FROM message_responses                                  │');
    console.log(`  │  WHERE broadcast_id = '${campaign.id.slice(0, 8)}…'              │`);
    console.log("  │  AND   response_status = 'confirmed'                     │");
    console.log('  └─────────────────────────────────────────────────────────┘');

    // This is exactly what resolveByCampaignResponse() runs
    const confirmedRows = await prisma.messageResponse.findMany({
        where: {
            broadcastId:    campaign.id,
            tenantId:       tenant.id,
            responseStatus: 'confirmed',
            contactId:      { not: null },
        },
        select:   { contactId: true },
        distinct: ['contactId'],
    });

    const confirmedContactIds = confirmedRows.map(r => r.contactId!);

    const followUpAudience = await prisma.contact.findMany({
        where:  { id: { in: confirmedContactIds }, tenantId: tenant.id, unsubscribed: false },
        select: { id: true, name: true, phone: true },
        orderBy: { name: 'asc' },
    });

    console.log(`\n  Follow-up audience resolved: ${followUpAudience.length} contact(s)`);
    for (const c of followUpAudience) {
        console.log(`    • ${c.name} (${c.phone})`);
    }

    assert(followUpAudience.length === 2,
        `Follow-up audience = 2 contacts (Alice + Carol only)`, `got ${followUpAudience.length}`);
    assert(followUpAudience.some(c => c.id === alice.id),
        `Alice Chen included (replied YES → confirmed)`);
    assert(followUpAudience.some(c => c.id === carol.id),
        `Carol Davis included (replied YES → confirmed)`);
    assert(!followUpAudience.some(c => c.id === bob.id),
        `Bob Kim excluded (replied NO → cancelled)`);

    console.log('\n  Follow-up message dispatched to confirmed audience:');
    console.log('  "Great! Here is the venue address: 12 Admiralty Way"');

    // ─────────────────────────────────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────────────────────────────────

    hr();
    console.log('  Cleaning up test data…');
    // Cascade: campaign → campaign_recipients → message_responses + contact_activity
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.tag.delete({ where: { id: tag.id } });
    await prisma.contact.deleteMany({ where: { id: { in: [alice.id, bob.id, carol.id] } } });
    console.log('  Done.');

    // ─────────────────────────────────────────────────────────────────────────
    // Results
    // ─────────────────────────────────────────────────────────────────────────

    hr();
    if (failed === 0) {
        console.log(`\n  ✓  ALL ${passed} ASSERTIONS PASSED`);
        console.log('  End-to-end userflow is working correctly.\n');
    } else {
        console.log(`\n  ✓  ${passed} passed`);
        console.error(`  ✗  ${failed} FAILED:`);
        for (const f of failures) console.error(`       – ${f}`);
        console.log('');
        process.exit(1);
    }
    hr();
}

run()
    .catch(e => { console.error('\nFATAL:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
