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
          a: '#3b82f6',
          'a-glow': '#60a5fa',
          b: '#ef4444',
          'b-glow': '#f87171',
        },
      },
      animation: {
        'glow-a': 'glow-a 2s ease-in-out infinite alternate',
        'glow-b': 'glow-b 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'glow-a': {
          '0%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(59, 130, 246, 0.6)' },
        },
        'glow-b': {
          '0%': { boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(239, 68, 68, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
