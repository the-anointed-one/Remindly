import { Injectable } from '@nestjs/common';

export interface TemplateContact {
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface TemplateAppointment {
  title: string;
  scheduledAt: Date;
  locationName?: string;
}

export interface TemplateBusiness {
  name: string;
}

/**
 * Renders template strings by replacing {{variable}} placeholders
 * with real values from contact, appointment, and business context.
 *
 * Supported variables:
 *   {{first_name}}, {{last_name}}, {{phone}}, {{email}},
 *   {{appointment_date}}, {{appointment_time}}, {{location}},
 *   {{event_name}}, {{business_name}}, {{company}}
 *
 * Unresolved variables are left intact (e.g. {{unknown_var}}).
 */
@Injectable()
export class TemplateRendererService {
  renderTemplate(
    template: string,
    contact?: TemplateContact,
    appointment?: TemplateAppointment,
    business?: TemplateBusiness,
  ): string {
    const vars = this.buildVars(contact, appointment, business);

    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      return key in vars ? vars[key] : match;
    });
  }

  private buildVars(
    contact?: TemplateContact,
    appointment?: TemplateAppointment,
    business?: TemplateBusiness,
  ): Record<string, string> {
    const vars: Record<string, string> = {};

    // Contact variables
    if (contact) {
      const nameParts = contact.name.trim().split(/\s+/);
      vars['first_name'] = nameParts[0] ?? '';
      vars['last_name'] = nameParts.slice(1).join(' ') || '';
      vars['phone'] = contact.phone ?? '';
      vars['email'] = contact.email ?? '';
    }

    // Appointment variables
    if (appointment) {
      const d = appointment.scheduledAt;
      vars['appointment_date'] = d.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      vars['appointment_time'] = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      vars['location'] = appointment.locationName ?? '';
      vars['event_name'] = appointment.title; // {{event_name}} → appointment / event title
    }

    // Business variables
    if (business) {
      vars['business_name'] = business.name;
      vars['company'] = business.name; // {{company}} → alias for business_name
    }

    return vars;
  }
}
