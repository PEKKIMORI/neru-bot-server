import { ChatMessageDTO } from '../dtos/chatMessage.dto';
import { Conversation } from './IConversation.interface';

export interface IConversationService {
  addMessageToHistory(
    userId: string,
    message: ChatMessageDTO,
  ): Promise<Conversation>;
  getHistory(userId: string): Promise<ChatMessageDTO[]>;
}
