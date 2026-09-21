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
  rawBody?: Buffer;
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

      const headers: Record<string, string> = { ...(init.headers ?? {}) };
      let payload: Buffer | undefined;

      if (init.rawBody) {
        payload = init.rawBody;
      } else if (init.body !== undefined) {
        const json = JSON.stringify(init.body);
        payload = Buffer.from(json, 'utf8');
        headers['Content-Type'] = 'application/json';
      }

      if (payload) {
        headers['Content-Length'] = payload.byteLength.toString();
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

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  });
}

export function buildMultipartBody(
  fieldName: string,
  filename: string,
  contentType: string,
  file: Buffer,
): { body: Buffer; contentType: string } {
  const boundary = '----SessionAITestBoundary7d4a';
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: Buffer.concat([Buffer.from(head, 'utf8'), file, Buffer.from(tail, 'utf8')]),
  };
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
    postRaw(
      path: string,
      rawBody: Buffer,
      headers: Record<string, string> = {},
    ): Promise<ResponseBody> {
      return send(app, 'POST', path, { rawBody, headers });
    },
    patch(
      path: string,
      body?: unknown,
      headers: Record<string, string> = {},
    ): Promise<ResponseBody> {
      return send(app, 'PATCH', path, { body, headers });
    },
    put(
      path: string,
      body?: unknown,
      headers: Record<string, string> = {},
    ): Promise<ResponseBody> {
      return send(app, 'PUT', path, { body, headers });
    },
    delete(path: string, headers: Record<string, string> = {}): Promise<ResponseBody> {
      return send(app, 'DELETE', path, { headers });
    },
  };
}
