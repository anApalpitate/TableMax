import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  appType: 'mpa',
  build: {
    outDir: '../../artifacts/phase-02/prototype',
    emptyOutDir: true,
    target: ['chrome110', 'safari16'],
    rolldownOptions: {
      input: fileURLToPath(new URL('prototype.html', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    open: '/prototype.html',
  },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
});
