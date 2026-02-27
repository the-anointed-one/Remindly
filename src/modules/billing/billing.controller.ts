import { Controller, Get } from '@nestjs/common';
import { BillingService } from './billing.service';
import { CurrentUser } from '../../common/decorators';

@Controller('billing')
export class BillingController {
    constructor(private readonly billingService: BillingService) { }

    @Get()
    findAll(@CurrentUser('tenantId') tenantId: string) {
        return this.billingService.findAll(tenantId);
    }
}
