import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // '/JusticeWatch/' was for the old GitHub Pages project-page URL
  // (username.github.io/JusticeWatch/). Now served at the domain root by
  // the FastAPI backend (see backend/api/main.py), so assets resolve from '/'.
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Built straight into backend/static so the single production container
    // (see /Dockerfile) can serve API + frontend from one process, matching
    // the nexus project's deploy pattern.
    outDir: '../backend/static',
    emptyOutDir: true,
    sourcemap: true,
  },
});
