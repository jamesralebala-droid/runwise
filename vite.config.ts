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
    // Multi-page app: index.html (marketing homepage) + app/index.html (the app,
    // served at /app). Relative inputs are resolved against the project root.
    // inlineDynamicImports must stay off — it is incompatible with multiple inputs.
    rollupOptions: {
      input: {
        main: 'index.html',
        app: 'app/index.html',
      },
      output: {
        manualChunks: undefined,
      },
    },
  },
});
