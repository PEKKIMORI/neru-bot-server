/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Logger } from '@nestjs/common';
import { ToolCall } from '../interfaces/ToolCall.interface';
import { ToolResponse } from '../interfaces/ToolResponse.interface';

interface ToolCallPayload {
  tool: string;
  arguments: { [key: string]: any };
}

@Injectable()
export class AIFunctionsHandler {
  private readonly logger = new Logger(AIFunctionsHandler.name);

  constructor() {}

  public tryParseToolCall(responseText: string): ToolCall | null {
    this.logger.log('Attempting to parse tool call from response');

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
        case 'getWeeklyHabitSummary':
          return this.handleWeeklyHabitSummary(userId);

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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ...(data && { data }),
    };
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
