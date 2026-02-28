import {
    Controller,
    Get,
    Post,
    Body,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { CurrentUser } from '../../common/decorators';

@Controller('billing')
export class BillingController {
    constructor(private readonly billingService: BillingService) { }

    @Get()
    getBillingInfo(@CurrentUser('tenantId') tenantId: string) {
        return this.billingService.getBillingInfo(tenantId);
    }

    @Post('subscribe')
    subscribe(
        @CurrentUser('tenantId') tenantId: string,
        @CurrentUser('userId') userId: string,
        @Body() body: { planCode: string; email: string },
    ) {
        return this.billingService.createSubscription(
            tenantId,
            userId,
            body.planCode,
            body.email,
        );
    }
}
