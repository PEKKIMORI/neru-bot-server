import { Injectable, Logger } from '@nestjs/common';
import {
  ILLMService,
  PromptContext,
} from 'src/ai/interfaces/LLM.service.interface';

import { ChatMessageDTO } from '../dtos/chatMessage.dto';
import { ConversationService } from './conversation.service';

@Injectable()
export class ConversationManagerService {
  private readonly logger = new Logger(ConversationManagerService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly llmService: ILLMService,
  ) {}

  public async getAiReply(
    userId: string,
    context: string,
    userMessage: string,
  ): Promise<string> {
    const conversation = await this.conversationService.getConversation(
      userId,
      context,
    );
    const history = conversation ? conversation.messages : [];
    this.logger.log(`Found ${history.length} previous messages.`);

    const formattedPrompt = this._buildPromptWithHistory(history, userMessage);
    this.logger.log(`Built formatted prompt for LLM.`);

    const llmContext: PromptContext = {
      prompt: formattedPrompt,
      userId: userId,
    };

    const responseStream = this.llmService.generateResponse(llmContext);

    let aiResponse = '';
    for await (const chunk of responseStream) {
      aiResponse += chunk;
    }

    await this.conversationService.addMessage(
      userId,
      context,
      'assistant',
      aiResponse,
    );

    return aiResponse;
  }

  private _buildPromptWithHistory(
    history: ChatMessageDTO[],
    newUserPrompt: string,
  ): string {
    const promptParts: string[] = [];

    for (const message of history) {
      promptParts.push(`<|${message.role}|>\n${message.content}`);
    }

    promptParts.push(`<|user|>\n${newUserPrompt}`);

    promptParts.push('<|assistant|>');

    return promptParts.join('\n');
  }
}
