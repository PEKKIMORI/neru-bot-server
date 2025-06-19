export interface ChatMessageDTO {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
