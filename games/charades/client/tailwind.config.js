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
        charades: {
          DEFAULT: '#10b981',
          glow: '#34d399',
          dark: '#059669',
        },
      },
      animation: {
        'glow-green': 'glow-green 2s ease-in-out infinite alternate',
        'card-in': 'card-in 0.3s ease-out',
        'flash-correct': 'flash-correct 0.4s ease-out',
        'flash-pass': 'flash-pass 0.4s ease-out',
      },
      keyframes: {
        'glow-green': {
          '0%': { boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(16, 185, 129, 0.6)' },
        },
        'card-in': {
          '0%': { opacity: '0', transform: 'scale(0.8) translateY(20px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'flash-correct': {
          '0%': { backgroundColor: 'rgba(16, 185, 129, 0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'flash-pass': {
          '0%': { backgroundColor: 'rgba(239, 68, 68, 0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
};
