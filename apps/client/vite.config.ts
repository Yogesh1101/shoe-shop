import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * Group third-party code into named vendor chunks.
         *
         * Without this, Rollup names a shared chunk after whichever of our
         * modules happened to pull it in first — which produced a 290 kB file
         * called "States", containing react-router rather than empty states.
         * That makes bundle size impossible to reason about.
         *
         * Splitting by library also caches better: these change only when a
         * dependency is upgraded, so a deploy that touches app code leaves the
         * visitor's cached vendor chunks intact.
         */
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('/react-router')) return 'vendor-router';
          if (/\/(@reduxjs|react-redux|redux-persist|redux|immer|reselect)\//.test(id)) {
            return 'vendor-redux';
          }
          if (/\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (id.includes('/lucide-react/')) return 'vendor-icons';
          if (id.includes('/radix-ui/') || id.includes('/@radix-ui/')) return 'vendor-radix';
          return 'vendor';
        },
      },
    },
  },
});
