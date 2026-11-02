import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'static' ? './' : '/',
  define: { 'import.meta.env.VITE_STATIC': JSON.stringify(mode === 'static' ? 'true' : '') },
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
  build: { chunkSizeWarningLimit: 1500 },
}));
