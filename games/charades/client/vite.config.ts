import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const serverPort = process.env.CHARADES_SERVER_PORT || '4050';

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT || '5174', 10),
    proxy: {
      '/api': {
        target: `http://localhost:${serverPort}`,
      },
    },
  },
});
