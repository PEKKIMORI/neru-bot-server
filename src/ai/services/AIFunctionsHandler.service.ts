/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Logger } from '@nestjs/common';
import { ToolCall } from '../interfaces/ToolCall.interface';
import { ToolResponse } from '../interfaces/ToolResponse.interface';
import { IAIFunctionsHandler } from '../interfaces/IAIFunctionsHandler.service.interface';

interface ToolCallPayload {
  tool: string;
  arguments: { [key: string]: any };
}

@Injectable()
export class AIFunctionsHandler implements IAIFunctionsHandler {
  private readonly logger = new Logger(AIFunctionsHandler.name);

  constructor() {}

  public tryParseToolCall(responseText: string): ToolCall | null {
    this.logger.log('Attempting to parse tool call from response');

    // Handle [func_name(params), ...] format
    const bracketMatch = responseText.match(/^\s*\[(.*)\]\s*$/s);
    if (bracketMatch) {
      const callsStr = bracketMatch[1];
      // Split by '),', but keep the closing parenthesis
      const callRegex = /([a-zA-Z0-9_]+)\(([^)]*)\)/g;
      let match;
      while ((match = callRegex.exec(callsStr)) !== null) {
        const tool = match[1];
        const argsStr = match[2];
        const args: { [key: string]: any } = {};
        if (argsStr.trim()) {
          // Split by comma, handle key=value pairs
          argsStr.split(',').forEach((pair) => {
            const [key, value] = pair.split('=');
            if (key && value !== undefined) {
              // Remove possible quotes from value
              const cleanValue = value
                .trim()
                .replace(/^"|"$/g, '')
                .replace(/^'|'$/g, '');
              args[key.trim()] = cleanValue;
            }
          });
        }
        this.logger.log(`Parsed tool call from bracket format: ${tool}`);
        return { tool, arguments: args };
      }
    }

    // Handle single func_name(params) format (no brackets)
    const singleCallMatch = responseText.match(
      /^\s*([a-zA-Z0-9_]+)\(([^)]*)\)\s*$/,
    );
    if (singleCallMatch) {
      const tool = singleCallMatch[1];
      const argsStr = singleCallMatch[2];
      const args: { [key: string]: any } = {};
      if (argsStr.trim()) {
        argsStr.split(',').forEach((pair) => {
          const [key, value] = pair.split('=');
          if (key && value !== undefined) {
            const cleanValue = value
              .trim()
              .replace(/^"|"$/g, '')  
              .replace(/^'|'$/g, '');
            args[key.trim()] = cleanValue;
          }
        });
      }
      this.logger.log(`Parsed tool call from single function format: ${tool}`);
      return { tool, arguments: args };
    }

    const cleanedText = responseText
      .trim()

      .replace(/<[^>]+>/g, '')

      .replace(/```json/g, '')
      .replace(/```/g, '');

    this.logger.debug(`Cleaned response text: ${cleanedText}`);

    try {
      const parsed = JSON.parse(cleanedText) as ToolCallPayload;
      if (parsed.tool && parsed.arguments) {
        this.logger.log(`Parsed tool call: ${parsed.tool}`);
        return parsed as ToolCall;
      }
    } catch (wholeError) {
      console.log(wholeError);
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as ToolCallPayload;
          if (parsed.tool && parsed.arguments) {
            this.logger.log(`Parsed tool call from substring: ${parsed.tool}`);
            return parsed as ToolCall;
          }
        } catch (subError) {
          this.logger.error(
            'JSON parse error in substring:',
            jsonMatch[0],
            subError,
          );
        }
      }
    }

    this.logger.log('No valid tool call found in response');
    return null;
  }

  public executeTool(toolCall: ToolCall, userId: string): ToolResponse {
    this.logger.log(`Executing tool: ${toolCall.tool}`);

    try {
      switch (toolCall.tool) {
        case 'handleWeeklyHabitSummary': // alias for AI output
          return this.handleWeeklyHabitSummary(userId);
        case 'answerNormally':
          return this.answerNormally(userId);

        default:
          return this.handleUnknownTool(toolCall.tool);
      }
    } catch (error) {
      this.logger.error(`Tool execution failed: ${error}`);
      return this.createErrorResponse(`Tool execution error: ${error}`);
    }
  }

  private createErrorResponse(message: string): ToolResponse {
    return {
      status: 'error',
      message,
    };
  }

  private createSuccessResponse(message: string, data?: any): ToolResponse {
    return {
      status: 'success',
      message,
      ...(data && { data }),
    };
  }

  private answerNormally(userId: string): ToolResponse {
    // In a real application, you would fetch user data or perform some logic
    const responseData = {
      userId,
      message: 'This is a normal response without tool usage.',
    };

    return this.createSuccessResponse(
      'Normal response generated',
      responseData,
    );
  }

  private handleWeeklyHabitSummary(userId: string): ToolResponse {
    // In real app, you'd fetch data from a service
    const summaryData = {
      userId,
      habits: [
        { name: 'Reading', count: 5 },
        { name: 'Exercise', count: 3 },
      ],
      week: new Date().toISOString().split('T')[0],
    };

    return this.createSuccessResponse(
      'Weekly habit summary retrieved',
      summaryData,
    );
  }

  private handleUnknownTool(toolName: string): ToolResponse {
    this.logger.warn(`Unknown tool called: ${toolName}`);
    return this.createErrorResponse(`Tool "${toolName}" not found.`);
  }
}
