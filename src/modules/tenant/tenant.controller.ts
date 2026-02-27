import { Controller, Get } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CurrentUser } from '../../common/decorators';

@Controller('tenants')
export class TenantController {
    constructor(private readonly tenantService: TenantService) { }

    @Get()
    findAll(@CurrentUser('tenantId') tenantId: string) {
        return this.tenantService.findAll(tenantId);
    }
}
