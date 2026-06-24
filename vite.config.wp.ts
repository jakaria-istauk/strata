import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

// WordPress build: same src/, emitted as a hashed JS+CSS bundle the plugin
// enqueues on its admin page (no index.html — wp-admin is the PHP entry).
//   - base './'   → assets resolve relative to the enqueued bundle URL
//   - manifest    → strata.php reads build/.vite/manifest.json to enqueue
//   - input main  → no HTML entry; one module graph from src/main.tsx
//   - publicDir   → fonts + logo copied into build/ (self-hosted, no CDN)
export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    outDir: 'strata-wp/build',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: { input: 'src/main.tsx' },
  },
});
