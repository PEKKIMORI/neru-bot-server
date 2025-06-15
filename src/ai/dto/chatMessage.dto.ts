/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsString, IsNotEmpty } from 'class-validator';

export class ChatMessageDto {
  @IsString({ message: 'Prompt must be a string.' })
  @IsNotEmpty({ message: 'Prompt cannot be empty.' })
  prompt: string;
}
