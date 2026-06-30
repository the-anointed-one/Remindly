/**
 * Plan limits — single source of truth.
 *
 * All per-tier caps live here. Billing sets these on activation,
 * validation checks them at runtime.
 *
 * PRICING TIERS:
 *   TRIAL        — 14-day trial, heavily restricted to protect infra
 *   SMS          — Tier 1: messaging only
 *   SMS_VOICE    — Tier 2: adds voice calls
 *   SMS_VOICE_AI — Tier 3: adds AI, highest limits
 */

export interface PlanLimits {
  /** Max contacts stored in the workspace */
  contactLimit: number;
  /** Max contacts in a single campaign send */
  campaignAudienceLimit: number;
  /** Max active automation workflows */
  workflowLimit: number;
  /** Max events (appointments) stored */
  eventLimit: number;
  /** Max SMS sends per month */
  smsMonthlyLimit: number;
  /** Max WhatsApp sends per month */
  whatsappMonthlyLimit: number;
  /** Max voice calls per month (0 = not available) */
  voiceMonthlyLimit: number;
  /** Max AI generations per month (0 = not available) */
  aiMonthlyLimit: number;
  /** Max automation executions per month */
  automationExecutionsLimit: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  TRIAL: {
    contactLimit:              100,
    campaignAudienceLimit:      50,
    workflowLimit:               3,
    eventLimit:                 50,
    smsMonthlyLimit:           100,
    whatsappMonthlyLimit:        0,   // not available on trial
    voiceMonthlyLimit:           0,   // not available on trial
    aiMonthlyLimit:              5,
    automationExecutionsLimit:  50,
  },

  SMS: {
    contactLimit:             1_000,
    campaignAudienceLimit:      500,
    workflowLimit:               10,
    eventLimit:                500,
    smsMonthlyLimit:          2_000,
    whatsappMonthlyLimit:       500,
    voiceMonthlyLimit:            0,  // voice not on SMS tier
    aiMonthlyLimit:               0,  // AI not on SMS tier
    automationExecutionsLimit:  500,
  },

  SMS_VOICE: {
    contactLimit:             5_000,
    campaignAudienceLimit:    2_000,
    workflowLimit:               25,
    eventLimit:               2_000,
    smsMonthlyLimit:         10_000,
    whatsappMonthlyLimit:     2_000,
    voiceMonthlyLimit:        1_000,
    aiMonthlyLimit:               0,  // AI not on SMS_VOICE tier
    automationExecutionsLimit: 2_000,
  },

  SMS_VOICE_AI: {
    contactLimit:            20_000,
    campaignAudienceLimit:   10_000,
    workflowLimit:              100,
    eventLimit:              10_000,
    smsMonthlyLimit:         50_000,
    whatsappMonthlyLimit:    10_000,
    voiceMonthlyLimit:        5_000,
    aiMonthlyLimit:             500,
    automationExecutionsLimit: 10_000,
  },
};

/** Get limits for a given plan type, defaulting to TRIAL if unknown */
export function getLimitsForPlan(planType: string): PlanLimits {
  return PLAN_LIMITS[planType] ?? PLAN_LIMITS['TRIAL'];
}
