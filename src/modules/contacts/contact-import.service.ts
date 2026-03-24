import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';
import { randomUUID } from 'crypto';

// ── Column name aliases (case-insensitive) ──

const NAME_ALIASES = [
  'name',
  'full name',
  'fullname',
  'contact name',
  'client name',
];
const PHONE_ALIASES = [
  'phone',
  'phone number',
  'mobile',
  'cell',
  'telephone',
  'tel',
];
const EMAIL_ALIASES = ['email', 'email address', 'e-mail'];
const TAGS_ALIASES = ['tags', 'tag', 'labels', 'groups'];
const NOTES_ALIASES = ['notes', 'note', 'comment', 'comments'];

function findColumn(headers: string[], aliases: string[]): string | undefined {
  return headers.find((h) => aliases.includes(h.toLowerCase().trim()));
}

export interface ParsedContact {
  name: string;
  phone?: string;
  email?: string;
  tags: string[];
  notes?: string;
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

// Basic E.164-ish phone validation — strips non-digits, checks length 7-15
function normalizePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return undefined;
  return digits.startsWith('0') ? digits : digits; // return as-is; real E.164 needs country code context
}

@Injectable()
export class ContactImportService {
  private readonly logger = new Logger(ContactImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse a CSV or Excel file buffer into contact rows.
   * Accepts .csv, .xlsx, .xls
   */
  parseContacts(buffer: Buffer, mimeType: string): ParsedContact[] {
    let workbook: XLSX.WorkBook;

    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException(
        'Could not parse file. Ensure it is a valid CSV or Excel file.',
      );
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException('File contains no sheets.');

    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
    });

    if (rows.length === 0)
      throw new BadRequestException('File is empty or has no data rows.');
    if (rows.length > 5000)
      throw new BadRequestException('Import limited to 5,000 rows per file.');

    const headers = Object.keys(rows[0]);
    const nameCol = findColumn(headers, NAME_ALIASES);
    const phoneCol = findColumn(headers, PHONE_ALIASES);
    const emailCol = findColumn(headers, EMAIL_ALIASES);
    const tagsCol = findColumn(headers, TAGS_ALIASES);
    const notesCol = findColumn(headers, NOTES_ALIASES);

    if (!nameCol) {
      throw new BadRequestException(
        `Could not find a "name" column. Headers found: ${headers.join(', ')}. ` +
          `Expected one of: ${NAME_ALIASES.join(', ')}.`,
      );
    }

    return rows
      .map((row, i) => {
        const rawName = String(row[nameCol] ?? '').trim();
        if (!rawName) return null; // skip blank rows

        const rawPhone = phoneCol
          ? String(row[phoneCol] ?? '').trim()
          : undefined;
        const rawEmail = emailCol
          ? String(row[emailCol] ?? '')
              .trim()
              .toLowerCase()
          : undefined;
        const rawTags = tagsCol ? String(row[tagsCol] ?? '') : '';
        const rawNotes = notesCol
          ? String(row[notesCol] ?? '').trim()
          : undefined;

        const tags = rawTags
          .split(/[,;|]/)
          .map((t: string) => t.trim().toLowerCase())
          .filter(Boolean);

        return {
          name: rawName,
          phone: normalizePhone(rawPhone),
          email: rawEmail || undefined,
          tags,
          notes: rawNotes || undefined,
        } as ParsedContact;
      })
      .filter((c): c is ParsedContact => c !== null);
  }

  validatePhoneNumbers(contacts: ParsedContact[]): {
    valid: ParsedContact[];
    invalid: string[];
  } {
    const valid: ParsedContact[] = [];
    const invalid: string[] = [];

    for (const c of contacts) {
      if (c.phone && c.phone.replace(/\D/g, '').length < 7) {
        invalid.push(`"${c.name}" — phone "${c.phone}" is too short`);
        // still include contact, just clear the bad phone
        valid.push({ ...c, phone: undefined });
      } else {
        valid.push(c);
      }
    }

    return { valid, invalid };
  }

  async bulkInsertContacts(
    tenantId: string,
    contacts: ParsedContact[],
  ): Promise<ImportResult> {
    if (contacts.length === 0) return { inserted: 0, skipped: 0, errors: [] };

    // Deduplicate within the import batch by name+phone+email
    const seen = new Set<string>();
    const deduped: ParsedContact[] = [];
    for (const c of contacts) {
      const key = `${c.name}|${c.phone ?? ''}|${c.email ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(c);
      }
    }

    let inserted = 0;
    let skipped = contacts.length - deduped.length;
    const errors: string[] = [];

    // Insert in chunks of 500
    const CHUNK = 500;
    for (let i = 0; i < deduped.length; i += CHUNK) {
      const chunk = deduped.slice(i, i + CHUNK);
      try {
        const result = await this.prisma.contact.createMany({
          data: chunk.map((c) => ({
            id: randomUUID(),
            tenantId,
            name: c.name,
            phone: c.phone,
            email: c.email,
            tags: c.tags,
            notes: c.notes,
          })),
          skipDuplicates: true,
        });
        inserted += result.count;
        skipped += chunk.length - result.count;
      } catch (err: any) {
        this.logger.error(`Bulk insert chunk failed: ${err.message}`);
        errors.push(`Chunk ${i / CHUNK + 1}: ${err.message}`);
      }
    }

    this.logger.log(
      `Bulk import complete: tenant=${tenantId} inserted=${inserted} skipped=${skipped}`,
    );
    return { inserted, skipped, errors };
  }

  async uploadCSV(
    tenantId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<ImportResult> {
    const parsed = this.parseContacts(buffer, mimeType);
    const { valid, invalid } = this.validatePhoneNumbers(parsed);
    const result = await this.bulkInsertContacts(tenantId, valid);
    if (invalid.length > 0) {
      result.errors.push(...invalid.map((msg) => `Phone warning: ${msg}`));
    }
    return result;
  }
}
