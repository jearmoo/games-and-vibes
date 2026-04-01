import basePreset from '@games/client-core/tailwind-preset';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [basePreset],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
