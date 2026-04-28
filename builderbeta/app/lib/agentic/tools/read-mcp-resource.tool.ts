/**
 * Read MCP Resource Tool — read resource content from a connected MCP server.
 */

import type { Tool, ToolResult, ToolUseContext, MCPNormalizedError, MCPResourceReadResult } from '../types';

export interface ReadMCPResourceInput {
  serverName: string;
  uri: string;
  endpoint?: string;
}

export interface ReadMCPResourceOutput {
  serverName: string;
  resource: MCPResourceReadResult;
}

interface MCPRouteSuccess<T> {
  success: true;
  data: T;
}

interface MCPRouteFailure {
  success: false;
  error: MCPNormalizedError;
}

export const ReadMCPResourceTool: Tool<ReadMCPResourceInput, ReadMCPResourceOutput> = {
  name: 'read_mcp_resource',
  displayName: 'Read MCP Resource',
  description: 'Read content for a specific MCP resource URI via /api/mcp.',

  inputSchema: {
    type: 'object',
    properties: {
      serverName: { type: 'string', description: 'Connected MCP server name' },
      uri: { type: 'string', description: 'MCP resource URI to read' },
      endpoint: { type: 'string', description: 'MCP API route endpoint (default: /api/mcp)' },
    },
    required: ['serverName', 'uri'],
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'mcp',
  searchHint: 'mcp resource read uri content',

  async execute(input: ReadMCPResourceInput, context: ToolUseContext): Promise<ToolResult<ReadMCPResourceOutput>> {
    const endpoint = input.endpoint || '/api/mcp';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resource_read',
          serverName: input.serverName,
          uri: input.uri,
        }),
        signal: context.abortSignal,
      });

      const payload = (await response.json()) as MCPRouteSuccess<ReadMCPResourceOutput> | MCPRouteFailure;

      if (!response.ok || payload.success === false) {
        const routeError = payload && 'error' in payload ? payload.error : undefined;
        return {
          success: false,
          data: {
            serverName: input.serverName,
            resource: {
              serverName: input.serverName,
              uri: input.uri,
            },
          },
          error: routeError?.message || `Failed to read MCP resource (status ${response.status})`,
        };
      }

      return {
        success: true,
        data: payload.data,
      };
    } catch (error: unknown) {
      return {
        success: false,
        data: {
          serverName: input.serverName,
          resource: {
            serverName: input.serverName,
            uri: input.uri,
          },
        },
        error: error instanceof Error ? error.message : 'Unknown MCP resource read error',
      };
    }
  },
};
