/**
 * Web Search Tool — Search the web for current information
 * Inspired by Claude Code's WebSearchTool (unreleased/upcoming)
 * Uses the E2B sandbox to run curl-based searches via DuckDuckGo
 */

import type { Tool, ToolResult, ToolUseContext, ToolCallProgress } from '../types';
import { getE2BSandbox } from '~/lib/e2b/sandbox';

export interface WebSearchInput {
  query: string;
  max_results?: number;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchOutput {
  query: string;
  results: WebSearchResult[];
  count: number;
}

export const WebSearchTool: Tool<WebSearchInput, WebSearchOutput> = {
  name: 'web_search',
  displayName: 'Web Search',
  description: `Search the web for current information. Returns titles, URLs, and snippets.

Use this when you need:
- Current documentation or API references
- Stack Overflow solutions for specific errors
- Latest package versions or changelogs
- Any information that may have changed since your training data`,

  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
      max_results: { type: 'number', description: 'Maximum results to return (default: 8, max: 20)' },
    },
    required: ['query'],
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'web',
  searchHint: 'search web internet google current information docs',

  async execute(input: WebSearchInput, context: ToolUseContext, onProgress?: ToolCallProgress): Promise<ToolResult<WebSearchOutput>> {
    const { query, max_results = 8 } = input;
    const limit = Math.min(max_results, 20);

    try {
      const sandbox = await getE2BSandbox();

      // Use DuckDuckGo HTML search (no API key needed)
      const encodedQuery = encodeURIComponent(query);
      const cmd = `curl -sL "https://html.duckduckgo.com/html/?q=${encodedQuery}" 2>/dev/null | grep -oP '<a rel="nofollow" class="result__a" href="[^"]*">[^<]*</a>' | head -${limit} | sed 's/<a rel="nofollow" class="result__a" href="//;s/">/\\t/;s/<\\/a>//'`;

      const result = await sandbox.commands.run(cmd, { timeoutMs: 15_000 });
      const stdout = (result as any)?.stdout || '';

      const results: WebSearchResult[] = stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line: string) => {
          const [url, title] = line.split('\t');
          return {
            title: title?.trim() || url || '',
            url: url?.trim() || '',
            snippet: '',
          };
        })
        .filter((r: WebSearchResult) => r.url);

      onProgress?.({
        toolUseId: '',
        type: 'web_search',
        data: { query, resultCount: results.length },
      });

      return {
        success: true,
        data: { query, results, count: results.length },
      };
    } catch (error: any) {
      return {
        success: false,
        data: { query, results: [], count: 0 },
        error: `Web search failed: ${error.message}`,
      };
    }
  },
};
