import type { Express } from 'express';
import http from 'node:http';

type ResponseBody = {
  status: number;
  body: {
    success?: boolean;
    data?: Record<string, unknown>;
    error?: { code: string; message: string };
  };
};

/**
 * Minimal request helper so Phase 1 tests avoid an extra HTTP client dependency.
 */
export function request(app: Express) {
  return {
    get(path: string, headers: Record<string, string> = {}): Promise<ResponseBody> {
      return new Promise((resolve, reject) => {
        const server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          if (!address || typeof address === 'string') {
            server.close();
            reject(new Error('Failed to bind test server'));
            return;
          }

          const req = http.request(
            {
              hostname: '127.0.0.1',
              port: address.port,
              path,
              method: 'GET',
              headers,
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on('data', (chunk: Buffer) => chunks.push(chunk));
              res.on('end', () => {
                server.close();
                const raw = Buffer.concat(chunks).toString('utf8');
                let body: ResponseBody['body'] = {};
                try {
                  body = JSON.parse(raw) as ResponseBody['body'];
                } catch {
                  body = {};
                }
                resolve({ status: res.statusCode ?? 0, body });
              });
            },
          );

          req.on('error', (err) => {
            server.close();
            reject(err);
          });
          req.end();
        });
      });
    },
  };
}
