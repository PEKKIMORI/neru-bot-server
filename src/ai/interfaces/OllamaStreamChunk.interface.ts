export interface OllamaStreamChunk {
  model: string;
  created_at: string;
  response?: string;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}
