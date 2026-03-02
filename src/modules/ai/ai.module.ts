import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { OpenAIProvider } from './openai.provider';

@Module({
    controllers: [AIController],
    providers: [AIService, OpenAIProvider],
    exports: [AIService, OpenAIProvider],
})
export class AIModule { }
