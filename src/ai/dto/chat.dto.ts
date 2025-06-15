import { IsArray } from 'class-validator';
import { ChatMessageDto } from './chatMessage.dto';

export class ChatDto {
  // user: User

  @IsArray()
  history: ChatMessageDto[];
}
