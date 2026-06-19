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
        castle: {
          stone: '#475569',
          'stone-glow': '#94a3b8',
          flame: '#dc2626',
          'flame-glow': '#f87171',
        },
      },
      animation: {
        'glow-stone': 'glow-stone 2s ease-in-out infinite alternate',
        'glow-flame': 'glow-flame 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'glow-stone': {
          '0%': { boxShadow: '0 0 20px rgba(71, 85, 105, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(71, 85, 105, 0.6)' },
        },
        'glow-flame': {
          '0%': { boxShadow: '0 0 20px rgba(220, 38, 38, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(220, 38, 38, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
