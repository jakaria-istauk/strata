import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Single source of truth for the app version: package.json (bump it per release).
import pkg from './package.json';

// Dev (`npm run dev`, :5173): proxy /api.php to Herd so the SPA and the PHP
//   gateway share an origin — no separate `php -S` needed (Herd runs PHP+MySQL).
// Prod (`npm run build`): outputs dist/ + copies api.php in; `strata.test` is
//   herd-linked to dist/, so the SPA and api.php are same-origin there too.
export default defineConfig({
  plugins: [react()],
  base: '/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    proxy: {
      '/api.php': { target: 'http://strata.test', changeOrigin: true },
    },
  },
});
