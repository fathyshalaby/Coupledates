import { readFileSync } from 'node:fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

const seoMetadata = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, 'src/lib/seo-metadata.json'), 'utf8'),
);
const couplesJournalMetadata = seoMetadata.couplesJournal as {
  title: string;
  description: string;
  image: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function couplesJournalStaticMetadata() {
  return {
    name: 'couples-journal-static-metadata',
    enforce: 'post' as const,
    apply: 'build' as const,
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      const index = bundle['index.html'] as { type?: string; source?: string } | undefined;
      if (!index || index.type !== 'asset' || index.source === undefined) {
        throw new Error(
          `Could not find the built Couple Dates HTML shell; bundle files: ${Object.keys(bundle).join(', ')}`,
        );
      }
      const indexHtml = typeof index.source === 'string'
        ? index.source
        : new TextDecoder().decode(index.source as Uint8Array);

      const siteOrigin = new URL(
        process.env.PUBLIC_SITE_URL || 'https://couple-dates.replit.app',
      ).origin;
      const prefix = basePath.replace(/\/+$/, '');
      const routeUrl = new URL(`${prefix}/couples-journal`, siteOrigin).href;
      const imageUrl = new URL(`${prefix}/${couplesJournalMetadata.image}`, siteOrigin).href;
      const htmlEscaped = {
        title: escapeHtml(couplesJournalMetadata.title),
        description: escapeHtml(couplesJournalMetadata.description),
        routeUrl: escapeHtml(routeUrl),
        imageUrl: escapeHtml(imageUrl),
      };

      let html = indexHtml.replace(
        /<title>[\s\S]*?<\/title>/i,
        `<title>${htmlEscaped.title}</title>`,
      );
      const tags = [
        [`name="description"`, `<meta name="description" content="${htmlEscaped.description}" />`],
        [`property="og:title"`, `<meta property="og:title" content="${htmlEscaped.title}" />`],
        [`property="og:description"`, `<meta property="og:description" content="${htmlEscaped.description}" />`],
        [`property="og:image"`, `<meta property="og:image" content="${htmlEscaped.imageUrl}" />`],
        [`name="twitter:title"`, `<meta name="twitter:title" content="${htmlEscaped.title}" />`],
        [`name="twitter:description"`, `<meta name="twitter:description" content="${htmlEscaped.description}" />`],
        [`name="twitter:image"`, `<meta name="twitter:image" content="${htmlEscaped.imageUrl}" />`],
      ] as const;
      for (const [selector, tag] of tags) {
        const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`<meta\\s+${escapedSelector}[^>]*>`, 'i');
        if (!pattern.test(html)) {
          throw new Error(`Could not find ${selector} in the built Couple Dates HTML shell.`);
        }
        html = html.replace(pattern, tag);
      }

      const journalLinks = [
        `<meta property="og:url" content="${htmlEscaped.routeUrl}" />`,
        `<link rel="canonical" href="${htmlEscaped.routeUrl}" />`,
      ].join('\n    ');
      html = html.replace('</head>', `    ${journalLinks}\n  </head>`);
      this.emitFile({
        type: 'asset',
        fileName: 'couples-journal/index.html',
        source: html,
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    couplesJournalStaticMetadata(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
