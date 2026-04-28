/**
 * Tool Search Tool — Find the right tool by description
 * Inspired by Claude Code's ToolSearchTool
 *
 * When there are many tools available, this lets the agent search
 * for relevant tools by keyword rather than scanning all tool descriptions.
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { agenticRegistry } from '../registry';

export interface ToolSearchInput {
  /** Search query describing what you want to do */
  query: string;
}

export interface ToolSearchMatch {
  name: string;
  displayName: string;
  description: string;
  category: string;
  relevance: number;
}

export const ToolSearchTool: Tool<ToolSearchInput, { matches: ToolSearchMatch[]; count: number }> = {
  name: 'tool_search',
  displayName: 'Search Tools',
  description: 'Search for available tools by keyword or description. Use when you need to find the right tool for a task.',

  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What you want to do (e.g., "edit a file", "search code", "run tests")' },
    },
    required: ['query'],
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'utility',
  searchHint: 'find tool search discover capability',

  async execute(input: ToolSearchInput, _context: ToolUseContext): Promise<ToolResult<{ matches: ToolSearchMatch[]; count: number }>> {
    const query = input.query.toLowerCase();
    const queryWords = query.split(/\s+/);

    const allTools = agenticRegistry.getAllTools();
    const scored: ToolSearchMatch[] = [];

    for (const tool of allTools) {
      let relevance = 0;
      const searchable = [
        tool.name,
        tool.displayName,
        tool.description,
        tool.searchHint || '',
        tool.category,
      ].join(' ').toLowerCase();

      for (const word of queryWords) {
        if (searchable.includes(word)) {
          relevance += 1;
          // Bonus for name/hint match
          if (tool.name.includes(word) || (tool.searchHint || '').includes(word)) {
            relevance += 1;
          }
        }
      }

      if (relevance > 0) {
        scored.push({
          name: tool.name,
          displayName: tool.displayName,
          description: tool.description.split('\n')[0] || tool.description,
          category: tool.category,
          relevance,
        });
      }
    }

    scored.sort((a, b) => b.relevance - a.relevance);
    const matches = scored.slice(0, 10);

    return { success: true, data: { matches, count: matches.length } };
  },
};
