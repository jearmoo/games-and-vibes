import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import basePreset from '@games/client-core/tailwind-preset';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  presets: [basePreset],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    resolve(__dirname, '../../../packages/client-core/src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        boom: {
          red: '#dc2626',
          'red-glow': '#f87171',
          blue: '#2563eb',
          'blue-glow': '#60a5fa',
          grey: '#6b7280',
          'grey-glow': '#9ca3af',
        },
      },
    },
  },
  plugins: [],
};
