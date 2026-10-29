import * as http from 'node:http';
import { ApiRouter } from './router.js';
import { logger } from '../core/index.js';

export interface ServerConfig {
  port?: number;
  host?: string;
}

export class AnvexoServer {
  private server: http.Server | null = null;
  private router: ApiRouter;
  private port: number;
  private host: string;

  constructor(config: ServerConfig = {}) {
    this.port = config.port || 4173;
    this.host = config.host || '127.0.0.1';
    this.router = new ApiRouter();
  }

  getRouter(): ApiRouter {
    return this.router;
  }

  async start(): Promise<{ port: number; host: string; url: string }> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.router.handleRequest(req, res).catch(err => {
          const msg = err instanceof Error ? err.message : 'Unknown server error';
          logger.error('server', `Internal handler failure: ${msg}`);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
          }
        });
      });

      this.server.on('error', reject);

      this.server.listen(this.port, this.host, () => {
        const address = this.server?.address();
        const actualPort = typeof address === 'object' && address ? address.port : this.port;
        const url = `http://${this.host}:${actualPort}`;
        logger.info('server', `ANVEXO API Server running at ${url}`);
        resolve({ port: actualPort, host: this.host, url });
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.router.getRateLimiter().destroy();
      this.server.close(err => {
        if (err) reject(err);
        else {
          this.server = null;
          logger.info('server', 'ANVEXO API Server stopped');
          resolve();
        }
      });
    });
  }
}
