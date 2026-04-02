/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cave: {
          50: '#fdf8f0',
          100: '#f5e6d0',
          200: '#e8cba0',
          300: '#d4a56a',
          400: '#c08840',
          500: '#a67030',
          600: '#8a5a28',
          700: '#6e4520',
          800: '#543518',
          900: '#3a2510',
        },
      },
    },
  },
  plugins: [],
};
