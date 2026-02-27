import { Controller, Get } from '@nestjs/common';
import { AIService } from './ai.service';
import { CurrentUser } from '../../common/decorators';

@Controller('ai')
export class AIController {
    constructor(private readonly aiService: AIService) { }

    @Get()
    findAll(@CurrentUser('tenantId') tenantId: string) {
        return this.aiService.findAll(tenantId);
    }
}
