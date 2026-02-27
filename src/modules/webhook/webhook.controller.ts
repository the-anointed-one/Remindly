import { Controller, Get } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { CurrentUser } from '../../common/decorators';

@Controller('webhooks')
export class WebhookController {
    constructor(private readonly webhookService: WebhookService) { }

    @Get()
    findAll(@CurrentUser('tenantId') tenantId: string) {
        return this.webhookService.findAll(tenantId);
    }
}
