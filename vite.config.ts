import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const hermesApiKey = env.VITE_HERMES_API_KEY ?? '';

  return {
    base: '/chat/',
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    server: {
      proxy: {
        // Dev mode: proxy /chat/api/* → http://127.0.0.1:8642/api/*
        // Adds auth header matching Nginx production config.
        '/chat/api': {
          target: 'http://127.0.0.1:8642',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/chat\/api/, '/api'),
          headers: {
            Authorization: `Bearer ${hermesApiKey}`,
          },
        },
      },
    },
  };
});
