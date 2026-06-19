import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const serverPort = process.env.DECRYPTO_SERVER_PORT || '4090';

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT || '5176', 10),
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
