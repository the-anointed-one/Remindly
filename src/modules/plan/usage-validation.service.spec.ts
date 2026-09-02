import { UsageValidationService } from './usage-validation.service';
import { PLAN_LIMITS } from './plan-limits';

// Focused unit test for the newly-added active-subscription SMS monthly cap.
function buildService(tenant: any) {
  const prisma: any = {
    tenant: { findUnique: jest.fn().mockResolvedValue(tenant) },
  };
  const configService: any = {};
  const auditService: any = { log: jest.fn().mockResolvedValue(undefined) };
  return new UsageValidationService(prisma, configService, auditService);
}

const activeSmsTenant = (smsUsageCount: number) => ({
  id: 't1',
  planType: 'SMS',
  subscriptionStatus: 'ACTIVE',
  trialActive: false,
  trialEndDate: null,
  smsUsageCount,
});

describe('UsageValidationService — active-subscription SMS monthly cap', () => {
  const limit = PLAN_LIMITS['SMS'].smsMonthlyLimit; // 2000

  it('blocks SMS once usage reaches the plan monthly limit', async () => {
    const svc = buildService(activeSmsTenant(limit));
    const result = await svc.validate('t1', 'SMS');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Monthly SMS usage limit reached/);
  });

  it('allows SMS while under the monthly limit', async () => {
    const svc = buildService(activeSmsTenant(5));
    const result = await svc.validate('t1', 'SMS');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(limit - 5);
  });
});
