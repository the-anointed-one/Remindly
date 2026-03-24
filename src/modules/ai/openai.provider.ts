import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  AIProvider,
  AICompletionParams,
  AICompletionResult,
} from './ai.provider';

@Injectable()
export class OpenAIProvider implements AIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');

    this.client = new OpenAI({ apiKey: apiKey || 'REDACTED_SK' });

    if (!apiKey) {
      this.logger.warn(
        'OpenAI API key not configured. Set OPENAI_API_KEY in .env',
      );
    }
  }

  async complete(params: AICompletionParams): Promise<AICompletionResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
        max_tokens: params.maxTokens ?? 500,
        temperature: params.temperature ?? 0.7,
      });

      const choice = response.choices[0];
      const text = choice?.message?.content?.trim() || '';
      const usage = response.usage;

      return {
        success: true,
        text,
        tokensUsed: usage?.total_tokens || 0,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        model: response.model,
      };
    } catch (error: any) {
      this.logger.error(`OpenAI completion failed: ${error.message}`);
      return {
        success: false,
        error: error.message || 'OpenAI request failed',
      };
    }
  }
}
