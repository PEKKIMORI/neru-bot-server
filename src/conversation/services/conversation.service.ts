import { Inject, Injectable, Logger } from '@nestjs/common';
import { Conversation } from '../interfaces/IConversation.interface';
import {
  CONVERSATION_REPOSITORY,
  IConversationRepository,
} from '../interfaces/IConversation.repository.interface';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
  ) {}

  public async addMessage(
    userId: string,
    context: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<Conversation> {
    this.logger.log(
      `Adding ${role} message for user "${userId}" in context "${context}"`,
    );

    let conversation = await this.conversationRepository.findByUserIdAndContext(
      userId,
      context,
    );

    if (!conversation) {
      this.logger.log(`No existing conversation found. Creating new one.`);
      conversation = new Conversation(userId, context);
    }

    conversation.addMessage(role, content);

    await this.conversationRepository.save(conversation);
    this.logger.log(`Conversation for user "${userId}" saved.`);

    return conversation;
  }

  public async getConversation(
    userId: string,
    context: string,
  ): Promise<Conversation | null> {
    this.logger.log(
      `Fetching conversation for user "${userId}" in context "${context}"`,
    );
    return this.conversationRepository.findByUserIdAndContext(userId, context);
  }
}
