import type { Plugin } from 'vite';
import { memory, plan, summary } from './records';

/** Opt-in LAN fixture for physical devices: no API proxy or provider SDK.
 * Writes are echoed, never forwarded or persisted. Unknown API paths fail. */
export function deviceServer(): Plugin {
  return {
    name: 'synthetic-device-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Block provider connections and external assets even on a real phone.
        res.setHeader('Content-Security-Policy',
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'none'; form-action 'self'");
        const path = new URL(req.url!, 'http://fixture.invalid').pathname;
        if (path === '/logo.svg') {
          res.setHeader('Content-Type', 'image/svg+xml');
          return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><circle cx="14" cy="14" r="10" fill="#c45c43"/></svg>');
        }
        if (req.method === 'GET' && path === '/api/storage/synthetic/original.png') {
          res.setHeader('Content-Type', 'image/png');
          return res.end(Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
            'base64',
          ));
        }
        if (!path.startsWith('/api/')) return next();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        const send = (value: unknown, status = 200) => {
          res.statusCode = status;
          res.end(JSON.stringify(value));
        };
        const reads: Record<string, unknown> = {
          '/api/dates': [plan], '/api/memories': [memory], '/api/summary': summary,
          '/api/preferences': [], '/api/reminders': [],
        };
        if (req.method === 'GET' && path in reads) return send(reads[path]);
        const isDate = req.method === 'POST' && path === '/api/dates';
        const isMemory = (req.method === 'POST' && path === '/api/memories')
          || (req.method === 'PATCH' && path === `/api/memories/${memory.id}`);
        if (!isDate && !isMemory) return send({ message: 'Blocked by synthetic device fixture' }, 403);
        try {
          let body = '';
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 16_384) return send({ message: 'Synthetic payload too large' }, 413);
          }
          send({ ...(isDate ? plan : memory), ...JSON.parse(body), id: isDate ? 900005 : memory.id });
        } catch {
          send({ message: 'Invalid synthetic JSON' }, 400);
        }
      });
    },
  };
}
