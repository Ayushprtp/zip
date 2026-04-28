/**
 * Web Fetch Tool — Fetch content from URLs
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';

export interface WebFetchInput {
  url: string;
  method?: string;
}

export const WebFetchTool: Tool<WebFetchInput, { url: string; status: number; content: string; truncated: boolean }> = {
  name: 'web_fetch',
  displayName: 'Fetch URL',
  description: 'Fetch content from a URL. Returns the response body as text (truncated to 100KB).',

  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch' },
      method: { type: 'string', description: 'HTTP method (default: GET)' },
    },
    required: ['url'],
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'web',
  searchHint: 'fetch http request url api web page',

  async execute(input: WebFetchInput, context: ToolUseContext): Promise<ToolResult<{ url: string; status: number; content: string; truncated: boolean }>> {
    try {
      const response = await fetch(input.url, { method: input.method || 'GET', signal: context.abortSignal });
      let content = await response.text();
      const truncated = content.length > 100_000;
      if (truncated) content = content.substring(0, 100_000);
      return { success: response.ok, data: { url: input.url, status: response.status, content, truncated } };
    } catch (error: any) {
      return { success: false, data: { url: input.url, status: 0, content: '', truncated: false }, error: `Fetch failed: ${error.message}` };
    }
  },
};
