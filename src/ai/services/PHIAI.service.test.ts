/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { PHIAIChat } from './PHIAI.service';
import { OllamaStreamChunk } from '../interfaces/OllamaStreamChunk.interface';

// Mock network requests and streams
const mockStreamResponse = (chunks: string[]) => ({
  body: new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) =>
        controller.enqueue(new TextEncoder().encode(chunk)),
      );
      controller.close();
    },
  }),
  ok: true,
});

vi.stubGlobal('fetch', vi.fn());

describe('PHIAIChat', () => {
  let service: PHIAIChat;
  const mockLogger = { log: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    service = new PHIAIChat();
    vi.spyOn(service['logger'], 'log').mockImplementation(mockLogger.log);
    vi.spyOn(service['logger'], 'error').mockImplementation(mockLogger.error);
    vi.mocked(fetch).mockReset();
  });

  describe('generateResponse', () => {
    it('should stream responses and return metadata', async () => {
      const testChunks = [
        JSON.stringify({ response: 'Hello', done: false }),
        JSON.stringify({
          response: ' World',
          done: true,
          total_duration: 500,
          prompt_eval_count: 10,
          eval_count: 20,
        }),
      ].join('\n');
      vi.mocked(fetch).mockResolvedValue(mockStreamResponse([testChunks]));

      const generator = service.generateResponse({ prompt: 'Test prompt' });
      const results: string[] = [];
      let lastResult: IteratorResult<string, any>;

      while (!(lastResult = await generator.next()).done) {
        results.push(lastResult.value);
      }
      const metadata = lastResult.value;

      expect(results).toEqual(['Hello', ' World']);
      expect(metadata).toEqual({
        modelUsed: 'phi3',
        totalDuration: 500,
        promptEvalCount: 10,
        evalCount: 20,
      });
    });

    it('should throw ServiceUnavailableException on network failure', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      await expect(async () => {
        const generator = service.generateResponse({ prompt: 'Test' });
        for await (const _ of generator) {
          /* empty */
        } // Consume generator
      }).rejects.toThrow(ServiceUnavailableException);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed during Ollama stream operation.',
        expect.any(Error),
      );
    });

    it('should handle invalid JSON chunks gracefully', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockStreamResponse(['invalid{json', '{"response":"valid"}']),
      );

      const generator = service.generateResponse({ prompt: 'Test' });
      const results: string[] = [];

      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toEqual(['valid']);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse JSON chunk from stream',
        'invalid{json',
      );
    });
  });

  describe('_performFetch', () => {
    it('should throw error on non-OK response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => 'Server error',
      } as unknown as Response);

      await expect(
        service['_performFetch']({ prompt: 'Test' }),
      ).rejects.toThrow('Ollama API returned status 500');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Ollama stream request failed: Server error',
      );
    });
  });

  describe('_processStream', () => {
    it('should correctly parse stream chunks', async () => {
      const mockStream = mockStreamResponse([
        '{"response":"Chunk1","done":false}\n{"response":"Chunk2","done":false}',
        '{"done":true}',
      ]).body;

      const processor = service['_processStream'](mockStream);
      const chunks: OllamaStreamChunk[] = [];
      for await (const chunk of processor) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([
        { response: 'Chunk1', done: false },
        { response: 'Chunk2', done: false },
        { done: true },
      ]);
    });
  });
});
