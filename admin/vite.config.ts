import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Standalone config — the original (Replit-generated) version required
// PORT / BASE_PATH env vars and Replit-only plugins and would crash outside
// that environment. This version runs anywhere with sensible defaults.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'wouter', '@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    port: Number(process.env.PORT) || 5174,
    host: '0.0.0.0',
  },
  preview: {
    port: Number(process.env.PORT) || 5174,
    host: '0.0.0.0',
  },
});
