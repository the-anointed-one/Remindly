import {
    Controller,
    Get,
    Post,
    Body,
} from '@nestjs/common';
import { AIService } from './ai.service';
import { CurrentUser } from '../../common/decorators';
import { PlanFeature } from '../plan/plan-feature.decorator';

@Controller('ai')
export class AIController {
    constructor(private readonly aiService: AIService) { }

    @PlanFeature('AI')
    @Post('generate-template')
    generateTemplate(
        @CurrentUser('tenantId') tenantId: string,
        @CurrentUser('userId') userId: string,
        @Body()
        body: {
            businessType: string;
            channel: string;
            purpose: string;
            tone?: string;
        },
    ) {
        return this.aiService.generateTemplate(tenantId, userId, body);
    }

    @PlanFeature('AI')
    @Post('improve-template')
    improveTemplate(
        @CurrentUser('tenantId') tenantId: string,
        @CurrentUser('userId') userId: string,
        @Body() body: { currentTemplate: string; improvementGoal?: string },
    ) {
        return this.aiService.improveTemplate(tenantId, userId, body);
    }

    @PlanFeature('AI')
    @Post('change-tone')
    changeTone(
        @CurrentUser('tenantId') tenantId: string,
        @CurrentUser('userId') userId: string,
        @Body() body: { currentTemplate: string; targetTone: string },
    ) {
        return this.aiService.changeTone(tenantId, userId, body);
    }

    @PlanFeature('AI')
    @Post('optimize-confirmation')
    optimizeConfirmation(
        @CurrentUser('tenantId') tenantId: string,
        @CurrentUser('userId') userId: string,
        @Body()
        body: {
            currentTemplate: string;
            channel: string;
            businessType?: string;
            currentConfirmationRate?: number;
        },
    ) {
        return this.aiService.optimizeConfirmationRate(tenantId, userId, body);
    }

    @Get('usage')
    getUsage(@CurrentUser('tenantId') tenantId: string) {
        return this.aiService.getUsageStats(tenantId);
    }
}
