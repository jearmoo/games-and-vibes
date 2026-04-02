import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const serverPort = process.env.ADTABOO_SERVER_PORT || '4040';

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT || '5173', 10),
    proxy: {
      '/socket.io': {
        target: `http://localhost:${serverPort}`,
        ws: true,
      },
    },
  },
});
