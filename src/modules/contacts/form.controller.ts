import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { CurrentUser, Public } from '../../common/decorators';
import { FormService } from './form.service';
import { CreateFormDto } from './dto/form.dto';

/**
 * JwtAuthGuard is registered globally (see app.module), so the organiser routes
 * below are protected by default and the public routes opt out via @Public().
 */
@Controller('forms')
export class FormController {
  constructor(private readonly formService: FormService) {}

  // ── Organiser (authenticated) ──────────────

  @Post()
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateFormDto,
  ) {
    return this.formService.createForm(tenantId, dto);
  }

  @Get()
  list(@CurrentUser('tenantId') tenantId: string) {
    return this.formService.listForms(tenantId);
  }

  @Delete(':id')
  deactivate(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.formService.deactivateForm(tenantId, id);
  }

  // ── Public ─────────────────────────────────

  @Public()
  @Get('s/:slug')
  getForm(@Param('slug') slug: string) {
    return this.formService.getFormBySlug(slug);
  }

  // Body is deliberately untyped: submissions carry whatever field names the
  // organiser configured, and a DTO class here would trip the global
  // forbidNonWhitelisted rule and reject every custom field.
  @Public()
  @Post('s/:slug/submit')
  submit(
    @Param('slug') slug: string,
    @Body() body: Record<string, string>,
  ) {
    return this.formService.submitForm(slug, body ?? {});
  }
}
