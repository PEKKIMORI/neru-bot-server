import { Injectable, Logger } from '@nestjs/common';
import { Conversation } from 'src/conversation/interfaces/IConversation.interface';
import { IConversationRepository } from 'src/conversation/interfaces/IConversation.repository.interface';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class RedisConversationRepository implements IConversationRepository {
  private readonly logger = new Logger(RedisConversationRepository.name);
  private readonly ttlSeconds = 24 * 60 * 60;

  constructor(private readonly redisService: RedisService) {}

  private getKey(userId: string, context: string): string {
    return `conversation:${userId}:${context}`;
  }

  async findByUserIdAndContext(
    userId: string,
    context: string,
  ): Promise<Conversation | null> {
    const key = this.getKey(userId, context);
    this.logger.log(`Finding conversation with key: ${key}`);

    const data = await this.redisService.getValue<Conversation>(key);

    if (!data) {
      return null;
    }
    const conversation = new Conversation(data.userId, data.context, data.id);
    Object.assign(conversation, {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      messages: data.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    });

    return conversation;
  }

  async save(conversation: Conversation): Promise<void> {
    const key = this.getKey(conversation.userId, conversation.context);
    this.logger.log(`Saving conversation with key: ${key}`);

    try {
      const result = await this.redisService.setValue(
        key,
        conversation,
        this.ttlSeconds,
      );

      if (result !== 'OK') {
        throw new Error('Redis SET command did not return OK');
      }
    } catch (error) {
      this.logger.error(`Failed to save conversation for key ${key}:`, error);
      throw error;
    }
  }
}
