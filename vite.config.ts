import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function activeEmployeesMiddleware(): Plugin {
  return {
    name: 'active-employees-middleware',
    configureServer(server) {
      server.middlewares.use('/chat/data/employees-active.json', (_req, res, next) => {
        const file = '/tmp/employees-active.json';
        if (!existsSync(file)) {
          // File doesn't exist yet — return empty object, not 404
          res.setHeader('Content-Type', 'application/json');
          res.end('{}');
          return;
        }
        try {
          const data = JSON.parse(readFileSync(file, 'utf-8'));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } catch {
          // Corrupted file — return empty object gracefully
          res.setHeader('Content-Type', 'application/json');
          res.end('{}');
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const hermesApiKey = env.VITE_HERMES_API_KEY ?? '';

  return {
    base: '/chat/',
    plugins: [react(), activeEmployeesMiddleware()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    server: {
      // Proxy /chat/api/* → Hermes API Server /api/*
      // Proxy /chat/v1/*  → Hermes API Server /v1/*  (chat completions)
      proxy: {
        '/chat/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/chat\/api/, '/api'),
          headers: {
            Authorization: `Bearer ${hermesApiKey}`,
          },
        },
        '/chat/v1': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/chat\/v1/, '/v1'),
          headers: {
            Authorization: `Bearer ${hermesApiKey}`,
          },
        },
      },
    },
  };
});
