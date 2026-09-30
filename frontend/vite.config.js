import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le proxy redirige /api et /auth vers le backend Express (port 3000) pour éviter les problèmes de CORS
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
    },
  },
});
