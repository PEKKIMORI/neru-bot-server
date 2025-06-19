import { Conversation } from './IConversation.interface';

export interface IConversationRepository {
  findByUserIdAndContext(
    userId: string,
    context: string,
  ): Promise<Conversation | null>;

  save(conversation: Conversation): Promise<void>;
}
export const CONVERSATION_REPOSITORY = 'CONVERSATION_REPOSITORY';
