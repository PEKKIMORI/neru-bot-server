import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  GenerationMetadata,
  ILLMService,
  PromptContext,
} from '../interfaces/LLM.service.interface';

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  response?: string;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

@Injectable()
export class PHIAIChat implements ILLMService {
  private readonly logger = new Logger(PHIAIChat.name);
  private readonly ollamaUrl = 'http://localhost:11434/api/generate';
  private readonly modelName = 'phi3';

  async *generateResponse(
    context: PromptContext,
  ): AsyncGenerator<string, GenerationMetadata, void> {
    this.logger.log(`Streaming prompt to model '${this.modelName}'...`);
    let finalChunk: OllamaStreamChunk | null = null;

    try {
      const response = await this._performFetch(context);
      const stream = this._processStream(response.body!);

      // Await each strongly-typed chunk from the stream processor
      for await (const chunk of stream) {
        // Type-safe access to the 'response' property
        if (chunk.response) {
          yield chunk.response;
        }
        // Type-safe access to the 'done' property
        if (chunk.done) {
          finalChunk = chunk;
        }
      }

      this.logger.log('Stream finished successfully.');
      return {
        modelUsed: this.modelName,
        totalDuration: finalChunk?.total_duration ?? 0,
        promptEvalCount: finalChunk?.prompt_eval_count ?? 0,
        evalCount: finalChunk?.eval_count ?? 0,
      };
    } catch (error) {
      this.logger.error('Failed during Ollama stream operation.', error);
      throw new ServiceUnavailableException('The AI service stream failed.');
    }
  }

  private async _performFetch(context: PromptContext): Promise<Response> {
    const requestBody = {
      model: this.modelName,
      prompt: context.prompt,
      stream: true,
    };

    try {
      const response = await fetch(this.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Ollama stream request failed: ${errorBody}`);
        throw new Error(`Ollama API returned status ${response.status}`);
      }
      return response;
    } catch (error) {
      this.logger.error('Failed to fetch from Ollama service.', error);
      throw error;
    }
  }

  private async *_processStream(
    stream: ReadableStream<Uint8Array>,
  ): AsyncGenerator<OllamaStreamChunk, void, void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const textChunk = decoder.decode(value);
        const jsonStrings = textChunk.split('\n').filter(Boolean);

        for (const jsonString of jsonStrings) {
          try {
            const parsed = JSON.parse(jsonString) as OllamaStreamChunk;
            yield parsed;
          } catch (e) {
            this.logger.error(
              'Failed to parse JSON chunk from stream',
              jsonString,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error('Error reading from Ollama stream.', error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
}
