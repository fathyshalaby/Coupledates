import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { deviceServer } from './device-server';

const root = path.dirname(fileURLToPath(import.meta.url));
const deviceMode = process.env.UI_DEVICE === '1';

// Separate from the shipped app entry point: no Clerk, API proxy, or secrets.
export default defineConfig({
  root,
  plugins: [react(), tailwindcss({ optimize: false }), ...(deviceMode ? [deviceServer()] : [])],
  resolve: {
    alias: { '@': path.resolve(root, '../../src') },
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
