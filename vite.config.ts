import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite plugin: serve /api/jobs by running the cron-bridge script.
 * Bridges `hermes cron list` CLI output to JSON API for the frontend.
 * Runs on each request to always return fresh data.
 */
function cronApiPlugin() {
  return {
    name: 'cron-api-middleware',
    configureServer(server: any) {
      server.middlewares.use('/api/jobs', (_req: any, res: any) => {
        try {
          const output = execSync(
            `node "${path.resolve(__dirname, 'scripts/cron-bridge.mjs')}"`,
            { encoding: 'utf-8', timeout: 10_000 }
          );
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(output);
        } catch {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ jobs: [] }));
        }
      });
    },
  };
}

export default defineConfig({
  base: '/chat/',
  plugins: [react(), cronApiPlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    proxy: {
      // In dev mode, proxy /chat/api/* → http://127.0.0.1:8642/api/*
      // Nginx strips /chat/api/ prefix and forwards to the API server.
      '/chat/api': {
        target: 'http://127.0.0.1:8642',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/chat\/api/, '/api'),
      },
    },
  },
});
