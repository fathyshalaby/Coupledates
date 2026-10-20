import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

// Separate from the shipped app entry point: no Clerk, API proxy, or secrets.
export default defineConfig({
  root,
  plugins: [react(), tailwindcss({ optimize: false })],
  resolve: {
    alias: { '@': path.resolve(root, '../../src') },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '127.0.0.1',
    port: 5189,
    strictPort: true,
    fs: { allow: [path.resolve(root, '../../../..')] },
  },
});
