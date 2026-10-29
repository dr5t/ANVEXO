import { ChildProcess, spawn } from 'node:child_process';
import { AnvexoError, McpServerConfig, McpToolSchema, PermissionScope, ToolDefinition, ToolResult } from '../core/types.js';

export class McpClient {
  private config: McpServerConfig;
  private process?: ChildProcess;
  private requestId = 0;
  private pendingRequests: Map<number, {
    resolve: (res: unknown) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }> = new Map();
  private buffer = '';
  private connected = false;

  constructor(config: McpServerConfig) {
    this.config = config;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (this.config.enabled === false) {
      throw new AnvexoError(`MCP server ${this.config.name} is disabled`, 'MCP_SERVER_DISABLED', false);
    }
    if (this.config.transport === 'stdio') {
      await this.connectStdio();
    } else if (this.config.transport === 'http') {
      await this.connectHttp();
    } else {
      throw new AnvexoError(`Unsupported MCP transport: ${this.config.transport}`, 'MCP_TRANSPORT_UNSUPPORTED', false);
    }
  }

  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      throw new AnvexoError('Command required for stdio transport', 'MCP_CONFIG_INVALID', false);
    }

    const proc = spawn(this.config.command, this.config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(this.config.env || {}) },
      shell: false,
    });

    this.process = proc;

    proc.stdout?.on('data', (chunk: Buffer) => {
      this.handleStdout(chunk.toString('utf-8'));
    });

    proc.on('error', (err) => {
      this.connected = false;
      this.failAllPending(new AnvexoError(`MCP process error: ${err.message}`, 'MCP_PROCESS_ERROR', true));
    });

    proc.on('exit', () => {
      this.connected = false;
      this.failAllPending(new AnvexoError('MCP server process exited', 'MCP_PROCESS_EXITED', true));
    });

    this.connected = true;

    try {
      await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'anvexo', version: '0.1.0' },
      }, 5000);
    } catch {
      this.connected = true;
    }
  }

  private async connectHttp(): Promise<void> {
    if (!this.config.url) {
      throw new AnvexoError('URL required for HTTP transport', 'MCP_CONFIG_INVALID', false);
    }
    const res = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.headers || {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++this.requestId,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          clientInfo: { name: 'anvexo', version: '0.1.0' },
        },
      }),
    });

    if (!res.ok) {
      throw new AnvexoError(`MCP HTTP server returned ${res.status}`, 'MCP_CONNECTION_FAILED', true);
    }
    this.connected = true;
  }

  async listTools(): Promise<McpToolSchema[]> {
    if (!this.connected) {
      await this.connect();
    }
    const res = await this.sendRequest('tools/list', {}, 5000) as { tools?: McpToolSchema[] };
    return res?.tools || [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const start = Date.now();
    try {
      const res = await this.sendRequest('tools/call', { name, arguments: args }, 15000) as {
        content?: Array<{ type: string; text?: string }>;
        isError?: boolean;
      };

      const duration = Date.now() - start;
      const textParts = (res.content || [])
        .filter((c) => c.type === 'text' && c.text)
        .map((c) => c.text!)
        .join('\n');

      return {
        success: !res.isError,
        output: textParts,
        duration,
        metadata: { server: this.config.name, tool: name },
      };
    } catch (err: unknown) {
      return {
        success: false,
        output: '',
        error: (err as Error).message,
        duration: Date.now() - start,
        metadata: { server: this.config.name, tool: name },
      };
    }
  }

  toToolDefinitions(schemas: McpToolSchema[]): ToolDefinition[] {
    const serverIdentifier = this.config.id || this.config.name;
    return schemas.map((s) => ({
      name: `mcp_${serverIdentifier}_${s.name}`,
      description: `[MCP: ${this.config.name}] ${s.description || s.name}`,
      requiredPermission: PermissionScope.MCP_CONNECT,
      risk: 'medium',
      execute: async (args: Record<string, unknown>) => {
        return this.callTool(s.name, args);
      },
    }));
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.failAllPending(new AnvexoError('MCP client disconnected', 'MCP_DISCONNECTED', true));
    if (this.process) {
      try {
        this.process.kill('SIGTERM');
      } catch {
        this.process.kill('SIGKILL');
      }
      this.process = undefined;
    }
  }

  private sendRequest(method: string, params: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
    const id = ++this.requestId;
    const req = { jsonrpc: '2.0', id, method, params };

    if (this.config.transport === 'http') {
      return this.sendHttpRequest(req, timeoutMs);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new AnvexoError(`MCP request timed out: ${method}`, 'MCP_TIMEOUT', true));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      if (this.process?.stdin?.writable) {
        this.process.stdin.write(JSON.stringify(req) + '\n');
      } else {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(new AnvexoError('MCP stdin not writable', 'MCP_PIPE_BROKEN', true));
      }
    });
  }

  private async sendHttpRequest(req: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(this.config.url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.headers || {}),
        },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new AnvexoError(`MCP HTTP request failed: ${res.status}`, 'MCP_HTTP_ERROR', true);
      }
      const data = await res.json() as { result?: unknown; error?: { message: string } };
      if (data.error) {
        throw new AnvexoError(data.error.message, 'MCP_RPC_ERROR', true);
      }
      return data.result;
    } catch (err: unknown) {
      clearTimeout(timer);
      throw err;
    }
  }

  private handleStdout(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const msg = JSON.parse(trimmed) as { id?: number; result?: unknown; error?: { message: string } };
        if (typeof msg.id === 'number') {
          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(msg.id);
            if (msg.error) {
              pending.reject(new AnvexoError(msg.error.message, 'MCP_SERVER_ERROR', true));
            } else {
              pending.resolve(msg.result);
            }
          }
        }
      } catch {
        continue;
      }
    }
  }

  private failAllPending(err: Error): void {
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(err);
      this.pendingRequests.delete(id);
    }
  }
}
