import { Controller, Get } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { CurrentUser } from '../../common/decorators';

@Controller('messaging')
export class MessagingController {
    constructor(private readonly messagingService: MessagingService) { }

    @Get()
    findAll(@CurrentUser('tenantId') tenantId: string) {
        return this.messagingService.findAll(tenantId);
    }
}
