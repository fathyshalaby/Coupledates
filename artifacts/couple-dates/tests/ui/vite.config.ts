import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { deviceServer } from './device-server';

const root = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.resolve(root, '../..');
const deviceMode = process.env.UI_DEVICE === '1';
const appRouteFixture = {
  name: 'real-app-route-ui-fixture',
  configureServer(server: { middlewares: { use: (handler: (req: { method?: string; url?: string }, res: unknown, next: () => void) => void) => void } }) {
    server.middlewares.use((req, _res, next) => {
      if (req.method === 'GET' && req.url?.split('?')[0] === '/at-home-date-ideas') {
        req.url = '/app-route.html';
      }
      next();
    });
  },
};

// Most checks use the isolated harness; this fixture serves the real app entry
// at the at-home route, with local auth stubs and no API proxy or secrets.
export default defineConfig({
  root,
  publicDir: path.resolve(root, '../../public'),
  plugins: [appRouteFixture, react(), tailwindcss({ optimize: false }), ...(deviceMode ? [deviceServer()] : [])],
  resolve: {
    alias: [
      { find: /^@clerk\/react\/internal$/, replacement: path.resolve(root, 'clerk-internal-stub.ts') },
      { find: /^@clerk\/react$/, replacement: path.resolve(root, 'clerk-react-stub.tsx') },
      { find: '@', replacement: path.resolve(artifactRoot, 'src') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: deviceMode ? '0.0.0.0' : '127.0.0.1',
    port: 5189,
    strictPort: true,
    // Vite needs workspace dependencies through /@fs/. Keep this a trusted-LAN
    // tool, and explicitly deny credential/config files in either mode.
    fs: {
      allow: [path.resolve(root, '../../../..')],
      deny: ['**/.env*', '**/*.{crt,pem,key}', '**/.git/**', '**/.replit*', '**/profile.md'],
    },
  },
});
