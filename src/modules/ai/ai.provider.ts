/**
 * AIProvider — abstract interface for AI/LLM providers.
 * Implement for OpenAI, Anthropic, etc.
 */
export interface AICompletionParams {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResult {
  success: boolean;
  text?: string;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
  error?: string;
}

export interface AIProvider {
  complete(params: AICompletionParams): Promise<AICompletionResult>;
}
