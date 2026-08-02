import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Base is configurable per deploy target:
  //  - Vercel (root domain): no RUNWISE_BASE set -> '/'
  //  - GitHub Pages (subpath): RUNWISE_BASE=/runwise/ set in the workflow
  base: process.env.RUNWISE_BASE || '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    hmr: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },
  },
});
