import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'

type LocalApiRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
  on?: (event: 'aborted', listener: () => void) => unknown;
};

type LocalApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => LocalApiResponse;
  json: (body: unknown) => unknown;
  write: (chunk: string) => boolean;
  end: () => void;
  on: (event: 'close', listener: () => void) => LocalApiResponse;
  flushHeaders: () => void;
  readonly headersSent: boolean;
  readonly writableEnded: boolean;
};

type LocalApiHandler = (
  request: LocalApiRequest,
  response: LocalApiResponse,
) => Promise<unknown>;

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 16_384) throw new Error('Request body too large');
    chunks.push(bytes);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function createApiResponse(response: ServerResponse): LocalApiResponse {
  const apiResponse: LocalApiResponse = {
    setHeader: (name, value) => response.setHeader(name, value),
    status(code) {
      response.statusCode = code;
      return apiResponse;
    },
    json(body) {
      if (!response.headersSent) {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      if (!response.writableEnded) response.end(JSON.stringify(body));
      return body;
    },
    write: (chunk) => response.write(chunk),
    end: () => { response.end(); },
    on(event, listener) {
      response.on(event, listener);
      return apiResponse;
    },
    flushHeaders: () => response.flushHeaders(),
    get headersSent() { return response.headersSent; },
    get writableEnded() { return response.writableEnded; },
  };
  return apiResponse;
}

const localDevApi = (): Plugin => ({
  name: 'jevling-local-api',
  configureServer(server) {
    const mountHandler = (route: string, modulePath: string) => {
      server.middlewares.use(route, (request, response, next) => {
        if (request.method !== 'POST') {
          next();
          return;
        }

        void (async () => {
          let body: unknown;
          try {
            body = await readJsonBody(request);
          } catch {
            sendJson(response, 400, { error: 'Invalid request body' });
            return;
          }

          try {
            const module = await server.ssrLoadModule(modulePath) as {
              default: LocalApiHandler;
            };
            await module.default(
              Object.assign(request, { body }) as LocalApiRequest,
              createApiResponse(response),
            );
          } catch (error) {
            console.error(
              `[vite${route}] Local handler failed:`,
              error instanceof Error ? error.name : 'UnknownError',
            );
            if (!response.headersSent) {
              sendJson(response, 500, route === '/api/talk'
                ? { error: 'Speech unavailable' }
                : { unavailable: true });
            }
          }
        })().catch(() => {
          if (!response.headersSent) {
            sendJson(response, 500, route === '/api/talk'
              ? { error: 'Speech unavailable' }
              : { unavailable: true });
          }
        });
      });
    };

    mountHandler('/api/decide', '/api/decide.ts');
    mountHandler('/api/talk', '/api/talk.ts');
  },
})

export default defineConfig(({ mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), '')
  for (const name of ['TYPESAFE_API_KEY', 'JEV_MODEL', 'GROQ_API_KEY', 'GROQ_MODEL'] as const) {
    if (!process.env[name] && localEnv[name]) process.env[name] = localEnv[name]
  }

  return {
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    plugins: [react(), tailwindcss(), localDevApi()],
  }
})
