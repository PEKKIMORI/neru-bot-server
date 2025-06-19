import { Module } from '@nestjs/common';
import { ConversationManagerService } from './services/conversationManager.service';

@Module({
  // imports: [
  //   ConversationModule,
  //   LlmModule,
  // ],
  providers: [ConversationManagerService],
  exports: [ConversationManagerService],
})
export class ChatModule {}
