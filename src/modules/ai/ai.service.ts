import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAIProvider } from './openai.provider';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAIProvider: OpenAIProvider,
    private readonly auditService: AuditService,
  ) {}

  // ── Plan & Usage Enforcement ───────────────

  private async enforceAccess(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) throw new ForbiddenException('Tenant not found');

    // Must be Tier 3 (SMS_VOICE_AI)
    if (tenant.planType !== 'SMS_VOICE_AI') {
      throw new ForbiddenException(
        'AI features require the SMS + Voice + AI plan (Tier 3). Upgrade your plan to access AI.',
      );
    }

    // Check subscription status
    if (!tenant.trialActive && tenant.subscriptionStatus !== 'ACTIVE') {
      throw new ForbiddenException(
        'AI features require an active subscription.',
      );
    }

    // Check usage limits
    if (tenant.trialActive) {
      if (tenant.aiUsageCount >= tenant.aiTrialLimit) {
        throw new ForbiddenException(
          `AI trial limit reached (${tenant.aiTrialLimit}). Upgrade to continue using AI.`,
        );
      }
    } else {
      if (tenant.aiUsageCount >= tenant.aiMonthlyLimit) {
        throw new ForbiddenException(
          `Monthly AI limit reached (${tenant.aiMonthlyLimit}). Resets on next billing cycle.`,
        );
      }
    }

    return tenant;
  }

  private async logUsage(
    tenantId: string,
    feature: string,
    inputText: string,
    outputText: string,
    tokensUsed: number,
    model: string,
    promptTokens = 0,
    completionTokens = 0,
  ) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { aiUsageCount: { increment: 1 } },
    });

    await this.prisma.aIUsageLog.create({
      data: {
        tenantId,
        feature,
        promptTokens,
        completionTokens,
        tokensUsed,
        model,
        inputText,
        outputText,
        costUsd: this.estimateCost(tokensUsed, model),
      },
    });

    this.logger.log(
      `AI usage: tenant=${tenantId} feature=${feature} tokens=${tokensUsed} ` +
        `(prompt=${promptTokens} completion=${completionTokens})`,
    );
  }

  private estimateCost(tokens: number, model: string): number {
    const rates: Record<string, number> = {
      'gpt-4o-mini': 0.00015,
      'gpt-4o': 0.005,
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.0005,
    };
    return ((rates[model] || 0.001) * tokens) / 1000;
  }

  // ── Generate Template ──────────────────────

  async generateTemplate(
    tenantId: string,
    userId: string,
    params: {
      businessType: string;
      channel: string;
      purpose: string;
      tone?: string;
    },
  ) {
    await this.enforceAccess(tenantId);

    const systemPrompt = `You are an expert at writing appointment reminder messages for businesses. 
You write concise, professional, and effective messages that maximize confirmation rates.
You ONLY return the message text. No explanations, no formatting, no markdown.
Keep messages under 160 characters for SMS, under 300 for email.`;

    const userPrompt = `Generate a ${params.channel} appointment reminder template for a ${params.businessType}.
Purpose: ${params.purpose}
Tone: ${params.tone || 'professional and friendly'}
Include template variables: {{customer_name}}, {{appointment_title}}, {{appointment_date}}, {{appointment_time}}.
Return ONLY the message text.`;

    const result = await this.openAIProvider.complete({
      systemPrompt,
      userPrompt,
      maxTokens: 200,
      temperature: 0.8,
    });

    if (!result.success)
      throw new ForbiddenException(`AI generation failed: ${result.error}`);

    await this.logUsage(
      tenantId,
      'generate_template',
      userPrompt,
      result.text!,
      result.tokensUsed || 0,
      result.model || 'unknown',
    );

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entity: 'AIGeneration',
      entityId: 'generate_template',
      newValues: { feature: 'generate_template', tokens: result.tokensUsed },
    });

    return { text: result.text, tokensUsed: result.tokensUsed };
  }

  // ── Improve Template ───────────────────────

  async improveTemplate(
    tenantId: string,
    userId: string,
    params: { currentTemplate: string; improvementGoal?: string },
  ) {
    await this.enforceAccess(tenantId);

    const systemPrompt = `You are an expert at optimizing appointment reminder messages.
You improve messages to be clearer, more engaging, and more effective.
You ONLY return the improved message text. No explanations.
Preserve any {{template_variables}} exactly as they are.`;

    const userPrompt = `Improve this appointment reminder template:
"${params.currentTemplate}"
${params.improvementGoal ? `Goal: ${params.improvementGoal}` : 'Make it more engaging.'}
Return ONLY the improved message text.`;

    const result = await this.openAIProvider.complete({
      systemPrompt,
      userPrompt,
      maxTokens: 200,
      temperature: 0.7,
    });

    if (!result.success)
      throw new ForbiddenException(`AI improvement failed: ${result.error}`);

    await this.logUsage(
      tenantId,
      'improve_template',
      userPrompt,
      result.text!,
      result.tokensUsed || 0,
      result.model || 'unknown',
    );

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entity: 'AIGeneration',
      entityId: 'improve_template',
      newValues: { feature: 'improve_template', tokens: result.tokensUsed },
    });

    return {
      original: params.currentTemplate,
      improved: result.text,
      tokensUsed: result.tokensUsed,
    };
  }

  // ── Change Tone ────────────────────────────

  async changeTone(
    tenantId: string,
    userId: string,
    params: { currentTemplate: string; targetTone: string },
  ) {
    await this.enforceAccess(tenantId);

    const systemPrompt = `You are an expert at adapting message tone while preserving meaning.
You ONLY return the rewritten message. No explanations.
Preserve any {{template_variables}} exactly as they are.`;

    const userPrompt = `Rewrite this reminder in a ${params.targetTone} tone:
"${params.currentTemplate}"
Return ONLY the rewritten message.`;

    const result = await this.openAIProvider.complete({
      systemPrompt,
      userPrompt,
      maxTokens: 200,
      temperature: 0.7,
    });

    if (!result.success)
      throw new ForbiddenException(`AI tone change failed: ${result.error}`);

    await this.logUsage(
      tenantId,
      'change_tone',
      userPrompt,
      result.text!,
      result.tokensUsed || 0,
      result.model || 'unknown',
    );

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entity: 'AIGeneration',
      entityId: 'change_tone',
      newValues: {
        feature: 'change_tone',
        tone: params.targetTone,
        tokens: result.tokensUsed,
      },
    });

    return {
      original: params.currentTemplate,
      rewritten: result.text,
      tone: params.targetTone,
      tokensUsed: result.tokensUsed,
    };
  }

  // ── Optimize Confirmation Rate ─────────────

  async optimizeConfirmationRate(
    tenantId: string,
    userId: string,
    params: {
      currentTemplate: string;
      channel: string;
      businessType?: string;
      currentConfirmationRate?: number;
    },
  ) {
    await this.enforceAccess(tenantId);

    const systemPrompt = `You are a behavioral science expert specializing in appointment attendance optimization.
You rewrite messages using proven techniques: social proof, commitment consistency, loss aversion, personalization.
You ONLY return the optimized message. No explanations.
Preserve any {{template_variables}} exactly as they are.
For SMS, keep under 160 characters.`;

    const userPrompt = `Optimize this ${params.channel} reminder for maximum confirmation rate:
"${params.currentTemplate}"
${params.businessType ? `Business type: ${params.businessType}` : ''}
${params.currentConfirmationRate ? `Current rate: ${params.currentConfirmationRate}%` : ''}
Return ONLY the optimized message.`;

    const result = await this.openAIProvider.complete({
      systemPrompt,
      userPrompt,
      maxTokens: 250,
      temperature: 0.6,
    });

    if (!result.success)
      throw new ForbiddenException(`AI optimization failed: ${result.error}`);

    await this.logUsage(
      tenantId,
      'optimize_confirmation',
      userPrompt,
      result.text!,
      result.tokensUsed || 0,
      result.model || 'unknown',
    );

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entity: 'AIGeneration',
      entityId: 'optimize_confirmation',
      newValues: {
        feature: 'optimize_confirmation',
        tokens: result.tokensUsed,
      },
    });

    return {
      original: params.currentTemplate,
      optimized: result.text,
      tokensUsed: result.tokensUsed,
    };
  }

  // ── Usage Stats ────────────────────────────

  async getUsageStats(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        aiUsageCount: true,
        aiTrialLimit: true,
        aiMonthlyLimit: true,
        trialActive: true,
        planType: true,
      },
    });

    if (!tenant) throw new ForbiddenException('Tenant not found');

    const limit = tenant.trialActive
      ? tenant.aiTrialLimit
      : tenant.aiMonthlyLimit;

    const recentLogs = await this.prisma.aIUsageLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        feature: true,
        tokensUsed: true,
        model: true,
        costUsd: true,
        createdAt: true,
      },
    });

    return {
      eligible: tenant.planType === 'SMS_VOICE_AI',
      plan: tenant.planType,
      used: tenant.aiUsageCount,
      limit,
      remaining: Math.max(0, limit - tenant.aiUsageCount),
      recentActivity: recentLogs,
    };
  }
}
