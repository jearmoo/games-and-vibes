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
        team: {
          a: '#d97706',
          'a-glow': '#fbbf24',
          b: '#059669',
          'b-glow': '#34d399',
        },
      },
      animation: {
        'glow-a': 'glow-a 2s ease-in-out infinite alternate',
        'glow-b': 'glow-b 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'glow-a': {
          '0%': { boxShadow: '0 0 20px rgba(217, 119, 6, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(217, 119, 6, 0.6)' },
        },
        'glow-b': {
          '0%': { boxShadow: '0 0 20px rgba(5, 150, 105, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(5, 150, 105, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
