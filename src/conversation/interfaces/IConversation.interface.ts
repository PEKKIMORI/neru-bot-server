import { randomUUID } from 'crypto';
import { ChatMessageDTO } from '../dtos/chatMessage.dto';

export class Conversation {
  public readonly id: string;
  public readonly userId: string;
  public readonly context: string;
  public messages: ChatMessageDTO[];
  public createdAt: Date;
  public updatedAt: Date;

  constructor(userId: string, context: string, id: string = randomUUID()) {
    this.id = id;
    this.userId = userId;
    this.context = context;
    this.messages = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  addMessage(role: 'user' | 'assistant', content: string) {
    this.messages.push({
      role,
      content,
      timestamp: new Date(),
    });
    this.updatedAt = new Date();
  }
}
