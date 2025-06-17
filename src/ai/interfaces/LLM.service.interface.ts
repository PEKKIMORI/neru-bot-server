import { IAIFunctionsHandler } from './IAIFunctionsHandler.service.interface';

export interface PromptContext {
  // persona: string;
  /** The profile of the user making the request, for deep personalization. */
  userId: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  prompt: string;
}

export interface GenerationMetadata {
  modelUsed: string;
  totalDuration: number;
  promptEvalCount: number;
  evalCount: number;
}

export abstract class ILLMService {
  constructor(protected readonly functionsHandler: IAIFunctionsHandler) {}
  abstract generateResponse(
    context: PromptContext,
  ): AsyncGenerator<string, GenerationMetadata, void>;
}
