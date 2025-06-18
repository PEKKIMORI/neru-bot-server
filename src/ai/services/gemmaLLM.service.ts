import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ILLMService,
  PromptContext,
  GenerationMetadata,
} from '../interfaces/LLM.service.interface';
import { ToolCall } from '../interfaces/ToolCall.interface';
import { AIFunctionsHandler } from './AIFunctionsHandler.service';
import { ToolResponse } from '../interfaces/ToolResponse.interface';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "AIzaSyB1RnQt9FUwyQEGBLM-jR0tWVHt3nrYaCY"});

const SYSTEM_PROMPT_WITH_TOOLS = `
You have access to functions. You MUST put it in the format of
[func_name1(params_name1=params_value1, params_name2=params_value2...), func_name2(params)]

You SHOULD NOT include any other text in the response

[
  {
    "name": "handleWeeklyHabitSummary",
    "description": "retrieve user's weekly habit summary",
    "userID": "userId",
  },
  {
    "name": "handleDailyHabitSummary",
    "description": "retrieve user's daily habit summary",
    "userID": "userId",
  },
  {
    "name": "answerNormally",
    "description": "answer the user normally without using any tools",
    "userID": "userId",
  }
]
`;

@Injectable()
export class GemmaLLM extends ILLMService {
  private readonly logger = new Logger(GemmaLLM.name);
  private readonly modelName = "gemma-3-12b-it";

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
      const toolResponseData = await this._handleToolCall(context, toolCall);
      yield* this._streamResponse(toolResponseData);
    } else {
      this.logger.log('No tool call detected. Streaming initial response.');
      yield initialResponse;
    }

    return this._generateMetadata();
  }

  private _buildFullPrompt(userPrompt: string): string {
    return `${SYSTEM_PROMPT_WITH_TOOLS}${userPrompt}`;
  }

  private async _getCompleteResponse(prompt: string): Promise<string> {
    try {
      // Use Google GenAI API to generate content
      const result = await ai.models.generateContent({
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      if (result && result.candidates && result.candidates.length > 0) {
        const candidate = result.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0 && candidate.content.parts[0].text) {
          return candidate.content.parts[0].text;
        }
      }
      throw new ServiceUnavailableException('LLM call failed: No response from GenAI');
    } catch (error) {
      this.logger.error(
        'Failed to fetch response from Google GenAI.',
        error,
      );
      throw new ServiceUnavailableException('LLM call failed');
    }
  }

  private async _handleToolCall(
    context: PromptContext,
    toolCall: ToolCall,
  ): Promise<string> {
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
    return finalPrompt;
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

    return `
    The user asked: "${userPrompt}"
    You decided to use the tool "${toolCall.tool}".
    The result of that tool call is: ${resultMessage}

    You are Yumeoi. Your mission is to be a companion who guides young people to live a life with more purpose and joy, helping them overcome procrastination and excessive social media use.
    Your personality:
    Friendly and cute: Use simple, short, and direct language. Be personal, encouraging, and fun. Use emojis! ✨
    Practical: Focus on small, real-world actions that take minimal effort to start.
    Accessible: Converse in a short light and easy-to-understand way, two sentences max.
    Reliable: Your suggestions are designed to genuinely help, with attention to detail.
    Your objective:
    To help the user who feels anxious, guilty, and unfocused. You don't judge them; instead, you offer a fun path to building better habits.
    How to act:
    You have already greeted your friend, and you know each other.
    `;
  }

  private async *_streamResponse(prompt: string): AsyncGenerator<string> {
    // Google GenAI API does not support streaming in the same way as Ollama,
    // so we will yield the full response at once.
    try {
      const result = await ai.models.generateContent({
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      if (result && result.candidates && result.candidates.length > 0) {
        const candidate = result.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0 && candidate.content.parts[0].text) {
          yield candidate.content.parts[0].text;
          return;
        }
      }
      throw new ServiceUnavailableException('LLM stream failed: No response from GenAI');
    } catch (error) {
      this.logger.error(
        'Failed to fetch streamed response from Google GenAI.',
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
