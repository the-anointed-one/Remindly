import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { generateQrToken } from '../../common/utils/qr-token.util';
import * as crypto from 'crypto';

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

@Injectable()
export class FormService {
  private readonly logger = new Logger(FormService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createForm(
    tenantId: string,
    dto: {
      title: string;
      description?: string;
      fields?: FormField[];
      eventId?: string;
    },
  ) {
    // A form with no fields would render nothing to fill in, so fall back to
    // the standard contact-collection trio.
    const fields =
      dto.fields && dto.fields.length > 0 ? dto.fields : DEFAULT_FIELDS;

    if (dto.eventId) {
      const event = await this.prisma.event.findFirst({
        where: { id: dto.eventId, tenantId },
        select: { id: true },
      });
      if (!event) {
        throw new BadRequestException('Linked event not found');
      }
    }

    return this.prisma.contactForm.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description,
        fields: fields as any,
        slug: this.generateSlug(dto.title),
        eventId: dto.eventId ?? null,
      },
    });
  }

  async getFormBySlug(slug: string) {
    const form = await this.prisma.contactForm.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        description: true,
        fields: true,
        isActive: true,
        tenant: { select: { name: true } },
      },
    });
    if (!form || !form.isActive) {
      throw new NotFoundException('Form not found');
    }
    return form;
  }

  async submitForm(slug: string, data: Record<string, string>) {
    const form = await this.prisma.contactForm.findUnique({
      where: { slug },
      select: {
        id: true,
        tenantId: true,
        fields: true,
        eventId: true,
        isActive: true,
      },
    });

    if (!form || !form.isActive) {
      throw new NotFoundException('Form not found');
    }

    const fields = (form.fields as unknown as FormField[]) ?? [];

    const name = (data.name || data.full_name || '').trim();
    const phone = (data.phone || data.mobile || '').trim();
    const email = (data.email || '').trim().toLowerCase();

    if (!name && !phone && !email) {
      throw new BadRequestException(
        'At least name, phone, or email is required',
      );
    }

    // The public page marks required fields with an asterisk; enforce it here
    // too, otherwise that asterisk promises something nothing checks.
    const missing = fields
      .filter((f) => f?.required && !String(data[f.name] ?? '').trim())
      .map((f) => f.label || f.name);
    if (missing.length > 0) {
      throw new BadRequestException(`Please fill in: ${missing.join(', ')}`);
    }

    const contact = await this.upsertContact(form.tenantId, {
      name,
      phone,
      email,
    });

    if (form.eventId) {
      await this.prisma.eventParticipant.upsert({
        where: {
          eventId_contactId: { eventId: form.eventId, contactId: contact.id },
        },
        create: {
          eventId: form.eventId,
          contactId: contact.id,
          tenantId: form.tenantId,
          status: 'invited',
          qrToken: generateQrToken(form.eventId, contact.id),
        },
        update: {},
      });
    }

    await this.prisma.contactForm.update({
      where: { id: form.id },
      data: { submissions: { increment: 1 } },
    });

    this.logger.log(
      `Form "${slug}" submitted → contact ${contact.id} (tenant ${form.tenantId})`,
    );

    return {
      success: true,
      message: 'Thank you! Your details have been saved.',
    };
  }

  /**
   * Match an existing contact on phone OR email before creating one.
   *
   * Contact carries BOTH @@unique([tenantId, email]) and
   * @@unique([tenantId, phone]), so a plain upsert keyed on email alone breaks
   * two ways: a phone-only submitter gets a fresh synthetic email every time
   * (never deduplicating), and the second submission from that same phone
   * collides on the phone constraint and 500s. Look the contact up on either
   * identifier instead, and leave missing identifiers null rather than
   * inventing placeholder addresses that later look like real data.
   */
  private async upsertContact(
    tenantId: string,
    input: { name: string; phone: string; email: string },
  ) {
    const { name, phone, email } = input;

    const existing = await this.prisma.contact.findFirst({
      where: {
        tenantId,
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (!existing) {
      return this.prisma.contact.create({
        data: {
          tenantId,
          name: name || phone || email,
          phone: phone || null,
          email: email || null,
          tags: ['form-submission'],
        },
      });
    }

    // Only fill blanks — never overwrite details the tenant already holds, and
    // never move an identifier that might belong to a different contact.
    const patch: Record<string, unknown> = {};
    if (!existing.name && name) patch.name = name;
    if (!existing.phone && phone) patch.phone = phone;
    if (!existing.email && email) patch.email = email;
    if (!existing.tags.includes('form-submission')) {
      patch.tags = { push: 'form-submission' };
    }

    if (Object.keys(patch).length === 0) return existing;

    try {
      return await this.prisma.contact.update({
        where: { id: existing.id },
        data: patch,
      });
    } catch (err: any) {
      // A blank we tried to fill is already taken by another contact in this
      // tenant. The submission still counts — keep the contact we matched.
      this.logger.warn(
        `Could not merge form submission into contact ${existing.id}: ${err.message}`,
      );
      return existing;
    }
  }

  async listForms(tenantId: string) {
    return this.prisma.contactForm.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForm(tenantId: string, formId: string) {
    const form = await this.prisma.contactForm.findFirst({
      where: { id: formId, tenantId },
    });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  async deactivateForm(tenantId: string, formId: string) {
    // Scope the write to the tenant — update() alone keys on id only, which
    // would let one tenant deactivate another tenant's form.
    const result = await this.prisma.contactForm.updateMany({
      where: { id: formId, tenantId },
      data: { isActive: false },
    });
    if (result.count === 0) throw new NotFoundException('Form not found');
    return { success: true };
  }

  private generateSlug(title: string): string {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);
    const suffix = crypto.randomBytes(4).toString('hex');
    return `${base || 'form'}-${suffix}`;
  }
}

const DEFAULT_FIELDS: FormField[] = [
  {
    name: 'name',
    label: 'Full Name',
    type: 'text',
    required: true,
    placeholder: 'Enter your full name',
  },
  {
    name: 'phone',
    label: 'Phone Number',
    type: 'tel',
    required: true,
    placeholder: '+234 800 000 0000',
  },
  {
    name: 'email',
    label: 'Email Address',
    type: 'email',
    required: false,
    placeholder: 'your@email.com',
  },
];
