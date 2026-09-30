import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le proxy redirige /api et Socket.IO vers le backend Express (port 3000) : même origine,
// donc le cookie de session httpOnly est envoyé automatiquement et il n'y a pas de CORS
// BACKEND_URL permet de viser un autre port (ex. vérification avant push)
const backend = process.env.BACKEND_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/socket.io': { target: backend, ws: true },
    },
  },
});
