import { describe, it, expect } from 'vitest';
import { McpClient } from '../../src/mcp/index.js';
import type { McpToolSchema } from '../../src/core/types.js';

describe('Model Context Protocol (MCP) Client', () => {
  it('converts MCP tool schemas to internal ToolDefinitions', () => {
    const client = new McpClient({
      name: 'test-server',
      transport: 'stdio',
      command: 'echo',
      enabled: true,
    });

    const mcpTools: McpToolSchema[] = [
      {
        name: 'sample_tool',
        description: 'Sample MCP tool description',
        inputSchema: {
          type: 'object',
          properties: {
            target: { type: 'string' },
          },
          required: ['target'],
        },
      },
    ];

    const definitions = client.toToolDefinitions(mcpTools);
    expect(definitions.length).toBe(1);
    expect(definitions[0].name).toBe('mcp_test-server_sample_tool');
    expect(definitions[0].description).toBe('[MCP: test-server] Sample MCP tool description');
    expect(definitions[0].risk).toBe('medium');
  });

  it('rejects connection if transport is invalid or disabled', async () => {
    const client = new McpClient({
      name: 'disabled-mcp',
      transport: 'stdio',
      command: 'nonexistent-cmd-xyz-123',
      enabled: false,
    });

    await expect(client.connect()).rejects.toThrow('disabled');
  });
});
