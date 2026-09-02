#!/usr/bin/env node
/**
 * Backfill Contact.phone values to E.164
 *
 * Existing contacts may hold loose local-format numbers (e.g. Nigerian
 * "08137999425") that Twilio rejects at send time. This normalizes them to
 * E.164 in place using the same helper the send paths use, and logs any that
 * can't be parsed for manual review.
 *
 * Dry-run by default. Pass --apply to write changes:
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-phone-e164.ts
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-phone-e164.ts --apply
 *
 * NOTE: assumes the default send country (NG) for local numbers — review the
 * "unparseable"/"changed" output before applying in a mixed-country tenant.
 */

import { PrismaClient } from '@prisma/client';
import { normalizePhoneForSend } from '../src/common/utils/normalize-phone.util';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`📞 Phone E.164 backfill (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`);

  const contacts = await prisma.contact.findMany({
    where: { phone: { not: null } },
    select: { id: true, name: true, phone: true, tenantId: true },
  });

  let changed = 0;
  let unchanged = 0;
  const unparseable: { id: string; name: string; phone: string }[] = [];

  for (const c of contacts) {
    const normalized = normalizePhoneForSend(c.phone);
    if (!normalized) {
      unparseable.push({ id: c.id, name: c.name, phone: c.phone! });
      continue;
    }
    if (normalized === c.phone) {
      unchanged++;
      continue;
    }
    changed++;
    console.log(`  ${c.phone}  →  ${normalized}   (${c.name})`);
    if (APPLY) {
      await prisma.contact.update({
        where: { id: c.id },
        data: { phone: normalized },
      });
    }
  }

  console.log(
    `\n✅ ${changed} ${APPLY ? 'updated' : 'would change'}, ${unchanged} already E.164, ${unparseable.length} unparseable.`,
  );
  if (unparseable.length) {
    console.log('\n⚠️  Unparseable (need manual review):');
    for (const u of unparseable) console.log(`  ${u.phone}  (${u.name}, id=${u.id})`);
  }
  if (!APPLY && changed > 0) console.log('\nRe-run with --apply to write these changes.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
