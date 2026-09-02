import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Readable } from 'stream';
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
  'mobile number',
  'cell',
  'cell number',
  'telephone',
  'tel',
  'contact number',
];
const EMAIL_ALIASES = ['email', 'email address', 'e-mail'];
const TAGS_ALIASES = ['tags', 'tag', 'labels', 'groups'];
const NOTES_ALIASES = ['notes', 'note', 'comment', 'comments'];

/**
 * Fold a raw spreadsheet header into its comparison form.
 *
 * Aliases are written space-separated ("full name"), but real exports just as
 * often use underscores or hyphens ("full_name", "phone-number"). Collapsing
 * those separators here covers every variant without duplicating each alias.
 */
function normaliseHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function findColumn(headers: string[], aliases: string[]): string | undefined {
  // Normalise both sides so hyphenated aliases like "e-mail" keep matching.
  const normalised = aliases.map(normaliseHeader);
  return headers.find((h) => normalised.includes(normaliseHeader(h)));
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
  return digits;
}

function cellValue(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'richText' in v) {
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
  }
  if (typeof v === 'object' && 'result' in v) {
    return String((v as ExcelJS.CellFormulaValue).result ?? '');
  }
  return String(v);
}

@Injectable()
export class ContactImportService {
  private readonly logger = new Logger(ContactImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse a CSV or Excel file buffer into contact rows.
   * Accepts .csv, .xlsx, .xls
   */
  async parseContacts(buffer: Buffer, mimeType: string): Promise<ParsedContact[]> {
    const workbook = new ExcelJS.Workbook();

    try {
      const isCsv =
        mimeType === 'text/csv' ||
        mimeType === 'application/csv' ||
        mimeType === 'text/plain';

      if (isCsv) {
        await workbook.csv.read(Readable.from(buffer));
      } else {
        // exceljs ships its own (older) Buffer typing that predates the
        // generic Buffer<TArrayBuffer> introduced in newer @types/node,
        // so TS sees a structural mismatch even though this is a real
        // Buffer at runtime.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await workbook.xlsx.load(buffer as any);
      }
    } catch {
      throw new BadRequestException(
        'Could not parse file. Ensure it is a valid CSV or Excel file.',
      );
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('File contains no sheets.');
    }

    // Extract header row
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell) => {
      headers.push(cellValue(cell));
    });

    if (headers.length === 0) {
      throw new BadRequestException('File is empty or has no data rows.');
    }

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

    const rows: ParsedContact[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const getField = (colName: string | undefined) => {
        if (!colName) return '';
        const colIndex = headers.indexOf(colName);
        if (colIndex < 0) return '';
        return cellValue(row.getCell(colIndex + 1)).trim(); // ExcelJS cells are 1-indexed
      };

      const rawName = getField(nameCol);
      if (!rawName) return; // skip blank rows

      const rawTags = getField(tagsCol ?? undefined);
      const tags = rawTags
        .split(/[,;|]/)
        .map((t: string) => t.trim().toLowerCase())
        .filter(Boolean);

      const rawEmail = getField(emailCol ?? undefined).toLowerCase();
      const rawPhone = getField(phoneCol ?? undefined);
      const rawNotes = getField(notesCol ?? undefined);

      rows.push({
        name: rawName,
        phone: normalizePhone(rawPhone),
        email: rawEmail || undefined,
        tags,
        notes: rawNotes || undefined,
      });
    });

    if (rows.length === 0) {
      throw new BadRequestException('File is empty or has no data rows.');
    }
    if (rows.length > 5000) {
      throw new BadRequestException('Import limited to 5,000 rows per file.');
    }

    return rows;
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
    const parsed = await this.parseContacts(buffer, mimeType);
    const { valid, invalid } = this.validatePhoneNumbers(parsed);
    const result = await this.bulkInsertContacts(tenantId, valid);
    if (invalid.length > 0) {
      result.errors.push(...invalid.map((msg) => `Phone warning: ${msg}`));
    }
    return result;
  }
}
