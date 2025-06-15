export interface PromptContext {
  // persona: string;
  /** The profile of the user making the request, for deep personalization. */
  // userProfile: UserProfile;
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
  abstract generateResponse(
    context: PromptContext,
  ): AsyncGenerator<string, GenerationMetadata, void>;
}
