export interface ToolCall {
  tool: string;
  arguments: { [key: string]: any };
}
