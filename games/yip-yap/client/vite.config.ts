import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const serverPort = process.env.YIPYAP_SERVER_PORT || '4070';

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT || '5174', 10),
    proxy: {
      '/socket.io': {
        target: `http://localhost:${serverPort}`,
        ws: true,
      },
      '/api': {
        target: `http://localhost:${serverPort}`,
      },
    },
  },
});
