import type { Express } from 'express';
import http from 'node:http';

type ResponseBody = {
  status: number;
  body: {
    success?: boolean;
    data?: Record<string, unknown> | unknown[] | unknown;
    error?: { code: string; message: string };
  };
};

type RequestInit = {
  headers?: Record<string, string>;
  body?: unknown;
};

function send(
  app: Express,
  method: string,
  path: string,
  init: RequestInit = {},
): Promise<ResponseBody> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to bind test server'));
        return;
      }

      const payload = init.body !== undefined ? JSON.stringify(init.body) : undefined;
      const headers: Record<string, string> = { ...(init.headers ?? {}) };
      if (payload !== undefined) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload).toString();
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: address.port,
          path,
          method,
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

      if (payload !== undefined) {
        req.write(payload);
      }
      req.end();
    });
  });
}

/**
 * Minimal request helper so tests avoid an extra HTTP client dependency.
 */
export function request(app: Express) {
  return {
    get(path: string, headers: Record<string, string> = {}): Promise<ResponseBody> {
      return send(app, 'GET', path, { headers });
    },
    post(path: string, body?: unknown, headers: Record<string, string> = {}): Promise<ResponseBody> {
      return send(app, 'POST', path, { body, headers });
    },
    patch(
      path: string,
      body?: unknown,
      headers: Record<string, string> = {},
    ): Promise<ResponseBody> {
      return send(app, 'PATCH', path, { body, headers });
    },
    delete(path: string, headers: Record<string, string> = {}): Promise<ResponseBody> {
      return send(app, 'DELETE', path, { headers });
    },
  };
}
