import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const serverPort = process.env.TWOROOMS_SERVER_PORT || '4080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT || '5175', 10),
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
