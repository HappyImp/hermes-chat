import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
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
