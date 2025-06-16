export interface ToolResponse {
  status: 'success' | 'error';
  message: string;
  data?: any;
}
