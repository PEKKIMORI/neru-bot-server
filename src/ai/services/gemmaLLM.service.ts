import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OllamaResponseDto } from '../dto/LLMResponse.dto';
import {
  ILLMService,
  PromptContext,
  GenerationMetadata,
} from '../interfaces/LLM.service.interface';
import { OllamaStreamChunk } from '../interfaces/OllamaStreamChunk.interface';
import { ToolCall } from '../interfaces/ToolCall.interface';
import { AIFunctionsHandler } from './AIFunctionsHandler.service';
import { ToolResponse } from '../interfaces/ToolResponse.interface';

const SYSTEM_PROMPT_WITH_TOOLS = `<|system|>
You are a tool-calling AI assistant. Your ONLY response should be a JSON object in this EXACT format:

{
  "tool": "tool_name",
  "arguments": {
    "arg1": value
  }
}

STRICT RULES:
1. DO NOT include any text before or after the JSON object
2. DO NOT wrap the JSON in markdown, XML, or any other formatting
3. DO NOT include explanations, thoughts, or additional text
4. DO NOT include any keys other than "tool" and "arguments"

AVAILABLE TOOLS:
1. getWeeklyHabitSummary - Retrieves weekly habit summary
   - Arguments: NONE (no arguments needed)
   
EXAMPLE FOR HABIT SUMMARY:
User: "How did I do this week?"
Response: {"tool": "getWeeklyHabitSummary", "arguments": {}}</|system|>

<|user|>
`;

@Injectable()
export class GemmaLLM extends ILLMService {
  private readonly logger = new Logger(GemmaLLM.name);
  private readonly ollamaUrl = 'http://localhost:11434/api/generate';
  private readonly modelName = 'gemma3:1b-it-qat';

  constructor(readonly functionsHandler: AIFunctionsHandler) {
    super(functionsHandler);
  }

  async *generateResponse(
    context: PromptContext,
  ): AsyncGenerator<string, GenerationMetadata, void> {
    this.logger.log(
      `Orchestrator: Starting response generation for prompt: "${context.prompt}"`,
    );

    const fullPrompt = this._buildFullPrompt(context.prompt);
    const initialResponse = await this._getCompleteResponse(fullPrompt);

    this.logger.log(`Raw initial response:, ${initialResponse}`);

    const toolCall = this.functionsHandler.tryParseToolCall(initialResponse);

    if (toolCall) {
      yield* this._handleToolCall(context, toolCall);
    } else {
      this.logger.log('No tool call detected. Streaming initial response.');
      yield initialResponse;
    }

    return this._generateMetadata();
  }

  private _buildFullPrompt(userPrompt: string): string {
    return `${SYSTEM_PROMPT_WITH_TOOLS}${userPrompt}</|user|>`;
  }

  private async _getCompleteResponse(prompt: string): Promise<string> {
    try {
      const response = await fetch(this.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          },
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Ollama non-stream request failed: ${errorText}`);
        throw new ServiceUnavailableException('LLM call failed');
      }
      const data = (await response.json()) as OllamaResponseDto;
      return data.response;
    } catch (error) {
      this.logger.error(
        'Failed to fetch non-streamed response from Ollama.',
        error,
      );
      throw new ServiceUnavailableException('LLM call failed');
    }
  }

  private async *_handleToolCall(
    context: PromptContext,
    toolCall: ToolCall,
  ): AsyncGenerator<string> {
    this.logger.log('Tool call detected. Executing tool...');

    const toolResult = this.functionsHandler.executeTool(
      toolCall,
      context.userId,
    );

    const finalPrompt = this._buildFinalPrompt(
      context.prompt,
      toolCall,
      toolResult,
    );

    this.logger.log('Streaming final response after tool execution...');
    yield* this._streamResponse(finalPrompt);
  }

  private _buildFinalPrompt(
    userPrompt: string,
    toolCall: ToolCall,
    toolResult: ToolResponse,
  ): string {
    let resultMessage;
    if (toolResult.status === 'success') {
      resultMessage = toolResult.message;
      if (toolResult.data) {
        resultMessage += `\nAdditional data: ${JSON.stringify(toolResult.data)}`;
      }
    } else {
      resultMessage = `Error: ${toolResult.message}`;
    }

    return `<|system|>
    The user asked: "${userPrompt}"
    You decided to use the tool "${toolCall.tool}".
    The result of that tool call is: ${resultMessage}
    Now, use this information to formulate a friendly, natural language response to the user.
    </|system|>
    <|assistant|>`;
  }

  private async *_streamResponse(prompt: string): AsyncGenerator<string> {
    try {
      const response = await fetch(this.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          stream: true,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          },
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Ollama stream request failed: ${errorText}`);
        throw new ServiceUnavailableException('LLM stream failed');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const textChunk = decoder.decode(value);
        const jsonStrings = textChunk.split('\n').filter(Boolean);

        for (const jsonString of jsonStrings) {
          try {
            const parsed = JSON.parse(jsonString) as OllamaStreamChunk;
            if (parsed.response) yield parsed.response;
          } catch (e) {
            this.logger.error(
              'Failed to parse JSON chunk from stream',
              jsonString,
              e,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        'Failed to fetch streamed response from Ollama.',
        error,
      );
      throw new ServiceUnavailableException('LLM stream failed');
    }
  }

  private _generateMetadata(): GenerationMetadata {
    return {
      modelUsed: this.modelName,
      totalDuration: 0,
      promptEvalCount: 0,
      evalCount: 0,
    };
  }
}
