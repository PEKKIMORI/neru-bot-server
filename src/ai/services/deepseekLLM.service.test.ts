/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable prefer-const */
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { deepseekLLM } from './deepseekLLM.service';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { GenerationMetadata } from '../interfaces/LLM.service.interface';
import { AIFunctionsHandler } from './AIFunctionsHandler.service';
import { ToolResponse } from '../interfaces/ToolResponse.interface';
import { ToolCall } from '../interfaces/ToolCall.interface';
import { IAIFunctionsHandler } from '../interfaces/IAIFunctionsHandler.service.interface';
import { GemmaLLM } from './gemmaLLM.service';

// --- Improved Mocking Helpers ---

/**
 * Creates a mock Response for a non-streaming JSON payload.
 */
const createMockJsonResponse = (body: any, ok = true): Response => {
  return {
    ok,
    status: ok ? 200 : 500,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    // Add other methods and properties as needed, with default values
    body: null,
    bodyUsed: false,
    redirected: false,
    statusText: ok ? 'OK' : 'Server Error',
    type: 'default',
    url: '',
    clone: vi.fn(),
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
  } as unknown as Response;
};

/**
 * Creates a mock Response for a streaming payload.
 */
const createMockStreamResponse = (chunks: string[], ok = true): Response => {
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => {
        controller.enqueue(new TextEncoder().encode(chunk));
      });
      controller.close();
    },
  });

  return {
    ok,
    status: ok ? 200 : 500,
    headers: new Headers({ 'Content-Type': 'application/x-ndjson' }),
    body: stream,
    text: () => Promise.resolve('Stream Body'), // Placeholder
    // Add other methods and properties as needed
    json: vi.fn(),
    bodyUsed: false,
    redirected: false,
    statusText: ok ? 'OK' : 'Server Error',
    type: 'default',
    url: '',
    clone: vi.fn(),
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
  } as unknown as Response;
};

// Global mocks
vi.stubGlobal('fetch', vi.fn());

// Mock AIFunctionsHandler
@Injectable()
class MockAIFunctionsHandler implements IAIFunctionsHandler {
  tryParseToolCall = vi.fn();
  executeTool = vi.fn();
}

describe('deepseekLLM', () => {
  let service: GemmaLLM;
  let functionsHandler: MockAIFunctionsHandler;
  const mockLogger = { log: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    functionsHandler = new MockAIFunctionsHandler();
    // The cast is okay here since we control the mock's implementation
    service = new GemmaLLM(functionsHandler as unknown as AIFunctionsHandler);

    // Spy on the logger within the instantiated service
    vi.spyOn(service['logger'], 'log').mockImplementation(mockLogger.log);
    vi.spyOn(service['logger'], 'error').mockImplementation(mockLogger.error);
    vi.mocked(fetch).mockReset();
  });

  describe('generateResponse', () => {
    it('should execute tool call when detected and return streamed response', async () => {
      // --- Setup ---
      const toolCall: ToolCall = {
        tool: 'testTool',
        arguments: { param: 'value' },
      };
      const toolResponse: ToolResponse = {
        status: 'success',
        message: 'Tool executed successfully',
        data: { result: 'Tool Result' },
      };

      // Mock the sequence of calls
      functionsHandler.tryParseToolCall.mockReturnValue(toolCall);
      functionsHandler.executeTool.mockReturnValue(toolResponse);

      // Mock the two fetch calls: 1. Tool detection, 2. Final streamed response
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          createMockJsonResponse({ response: JSON.stringify(toolCall) }),
        )
        .mockResolvedValueOnce(
          createMockStreamResponse([
            JSON.stringify({ response: 'Final', done: false }),
            JSON.stringify({ response: ' Answer', done: false }),
            JSON.stringify({ done: true }),
          ]),
        );

      // --- Execute ---
      const generator = service.generateResponse({
        prompt: 'Test prompt',
        userId: 'user123',
      });

      // --- Consume Generator Correctly ---
      const results: string[] = [];
      let metadata: GenerationMetadata | undefined;

      while (true) {
        const { done, value } = await generator.next();
        if (done) {
          metadata = value; // The 'return' value is in 'value' when 'done' is true
          break;
        }
        results.push(value); // The 'yield'ed values
      }

      // --- Verify ---
      expect(results).toEqual(['Final', ' Answer']);
      expect(functionsHandler.tryParseToolCall).toHaveBeenCalledWith(
        JSON.stringify(toolCall),
      );
      expect(functionsHandler.executeTool).toHaveBeenCalledWith(
        toolCall,
        'user123',
      );
      expect(metadata).toEqual({
        modelUsed: 'deepseek-r1:1.5b',
        totalDuration: 0,
        promptEvalCount: 0,
        evalCount: 0,
      });
    });

    it('should return direct response when no tool call detected', async () => {
      // --- Setup ---
      functionsHandler.tryParseToolCall.mockReturnValue(null);
      vi.mocked(fetch).mockResolvedValueOnce(
        createMockJsonResponse({ response: 'Direct response' }),
      );

      // --- Execute & Consume ---
      const generator = service.generateResponse({
        prompt: 'Test prompt',
        userId: 'user123',
      });

      const result1 = await generator.next();
      const result2 = await generator.next();

      // --- Verify ---
      expect(result1.done).toBe(false);
      expect(result1.value).toBe('Direct response');
      expect(result2.done).toBe(true);
      expect(result2.value).toEqual({
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
        await generator.next(); // Start the generator to trigger the fetch
      }).rejects.toThrow(ServiceUnavailableException);

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // The tests for private methods can also be simplified with the helpers
  describe('_getCompleteResponse', () => {
    it('should throw error on non-OK response', async () => {
      // Setup
      vi.mocked(fetch).mockResolvedValue(
        createMockJsonResponse({ message: 'Server error' }, false),
      );

      // Execute & Verify
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (service as any)._getCompleteResponse('prompt'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('_streamResponse', () => {
    it('should correctly parse valid stream chunks', async () => {
      // Setup
      vi.mocked(fetch).mockResolvedValue(
        createMockStreamResponse([
          '{"response":"Chunk1","done":false}\n',
          '{"response":"Chunk2","done":false}\n',
          '{"done":true}',
        ]),
      );

      const generator = (service as any)._streamResponse('prompt');
      const results: string[] = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toEqual(['Chunk1', 'Chunk2']);
    });
  });
});
