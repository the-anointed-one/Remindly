import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsFilterService {
  /**
   * Applies common filters for analytics queries, specifically tenantId
   * and the isDemoData exclusion flag.
   */
  applyTenantFilter<T extends { tenantId: string; isDemoData?: boolean }>(
    query: any,
    tenantId: string,
    excludeDemo = true,
  ): T {
    return {
      ...query,
      tenantId,
      ...(excludeDemo && { isDemoData: false }),
    };
  }
}
