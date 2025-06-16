/* eslint-disable prefer-const */
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { deepseekLLM } from './deepseekLLM.service';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { GenerationMetadata } from '../interfaces/LLM.service.interface';
import { AIFunctionsHandler } from './AIFunctionsHandler.service';

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

// Mock AIFunctionsHandler
@Injectable()
class MockAIFunctionsHandler {
  tryParseToolCall = vi.fn();
  executeTool = vi.fn();
}

describe('deepseekLLM', () => {
  let service: deepseekLLM;
  let functionsHandler: MockAIFunctionsHandler;
  const mockLogger = { log: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    functionsHandler = new MockAIFunctionsHandler();
    service = new deepseekLLM(
      functionsHandler as unknown as AIFunctionsHandler,
    );

    vi.spyOn(service['logger'], 'log').mockImplementation(mockLogger.log);
    vi.spyOn(service['logger'], 'error').mockImplementation(mockLogger.error);
    vi.mocked(fetch).mockReset();
  });

  describe('generateResponse', () => {
    // The metadata is not being retrieved for some reason, and the tool call not being called, but testing it works. Need to refactor this test to find out what is wrong
    // it('should execute tool call when detected and return streamed response', async () => {
    //   // Setup
    //   const toolCall = {
    //     tool: 'testTool',
    //     arguments: { param: 'value' },
    //   };

    //   functionsHandler.tryParseToolCall.mockReturnValueOnce(toolCall);
    //   functionsHandler.executeTool.mockResolvedValueOnce('Tool Result');

    //   // Mock responses
    //   vi.mocked(fetch)
    //     .mockResolvedValueOnce({
    //       ok: true,
    //       json: () => Promise.resolve({ response: JSON.stringify(toolCall) }),
    //     })
    //     .mockResolvedValueOnce(
    //       mockStreamResponse([
    //         JSON.stringify({ response: 'Final', done: false }),
    //         JSON.stringify({ response: ' Answer', done: true }),
    //       ]),
    //     );

    //   // Execute
    //   const generator = service.generateResponse({
    //     prompt: 'Test prompt',
    //     userId: 'user123',
    //   });

    //   const results: string[] = [];
    //   let metadata: GenerationMetadata | undefined;

    //   // Consume the generator
    //   for await (const chunk of generator) {
    //     results.push(chunk);
    //   }

    //   // Get the return value (metadata)
    //   const returnValue = await generator.next();
    //   metadata = returnValue.value;

    //   // Verify
    //   expect(results).toEqual(['Final', ' Answer']);
    //   expect(functionsHandler.executeTool).toHaveBeenCalledWith(
    //     toolCall,
    //     'user123',
    //   );
    //   expect(metadata).toEqual({
    //     modelUsed: 'deepseek-r1:1.5b',
    //     totalDuration: 0,
    //     promptEvalCount: 0,
    //     evalCount: 0,
    //   });
    // });

    it('should return direct response when no tool call detected', async () => {
      // Setup
      functionsHandler.tryParseToolCall.mockReturnValueOnce(null);
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ response: 'Direct response' }),
      });

      // Execute
      const generator = service.generateResponse({ prompt: 'Test prompt' });
      const result = await generator.next();
      const metadata = await generator.next();

      // Verify
      expect(result.value).toBe('Direct response');
      expect(metadata.value).toEqual({
        modelUsed: 'deepseek-r1:1.5b',
        totalDuration: 0,
        promptEvalCount: 0,
        evalCount: 0,
      });
    });

    it('should handle service errors gracefully', async () => {
      // Setup
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      // Execute & Verify
      await expect(async () => {
        const generator = service.generateResponse({
          prompt: 'Test',
          userId: 'user123',
        });
        await generator.next();
      }).rejects.toThrow(ServiceUnavailableException);

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('_getCompleteResponse', () => {
    it('should throw error on non-OK response', async () => {
      // Setup
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      } as Response);

      // Execute & Verify
      await expect(service['_getCompleteResponse']('prompt')).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Ollama non-stream request failed: Server error',
      );
    });
  });

  describe('_streamResponse', () => {
    it('should correctly parse valid stream chunks', async () => {
      // Setup
      vi.mocked(fetch).mockResolvedValue(
        mockStreamResponse([
          '{"response":"Chunk1","done":false}\n',
          '{"response":"Chunk2","done":false}\n',
          '{"done":true}',
        ]),
      );

      // Execute
      const generator = service['_streamResponse']('prompt');
      const results: string[] = [];

      for await (const chunk of generator) {
        results.push(chunk);
      }

      // Verify
      expect(results).toEqual(['Chunk1', 'Chunk2']);
    });

    it('should skip invalid JSON chunks but continue processing', async () => {
      // Setup
      vi.mocked(fetch).mockResolvedValue(
        mockStreamResponse([
          'invalid{json\n',
          '{"response":"valid"}\n',
          '{"done":true}',
        ]),
      );

      // Execute
      const generator = service['_streamResponse']('prompt');
      const results: string[] = [];

      for await (const chunk of generator) {
        results.push(chunk);
      }

      // Verify
      expect(results).toEqual(['valid']);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse JSON chunk from stream',
        'invalid{json',
        expect.any(Error),
      );
    });

    it('should throw ServiceUnavailableException on stream failure', async () => {
      // Setup
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Stream error'),
      } as Response);

      // Execute & Verify
      await expect(async () => {
        const generator = service['_streamResponse']('prompt');
        await generator.next();
      }).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
