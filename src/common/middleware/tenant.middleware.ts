import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Tenant-scoping middleware.
 *
 * Extracts `tenant_id` from the JWT payload (already attached to
 * `request.user` by Passport's JwtStrategy) and copies it onto
 * `request.tenantId` for easy downstream access.
 *
 * Public / unauthenticated routes are skipped — the guard layer
 * handles auth enforcement, not this middleware.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user;

    if (user?.tenantId) {
      (req as any).tenantId = user.tenantId;
    }

    next();
  }
}
