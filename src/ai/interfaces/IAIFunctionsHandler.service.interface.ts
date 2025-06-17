import { ToolCall } from './ToolCall.interface';
import { ToolResponse } from './ToolResponse.interface';

export interface IAIFunctionsHandler {
  tryParseToolCall(responseText: string): ToolCall | null;
  executeTool(toolCall: ToolCall, userId: string): ToolResponse;
}
