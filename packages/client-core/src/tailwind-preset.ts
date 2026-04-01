/** Base Tailwind preset for the games platform. Provides dark glassmorphism design system. */
const basePreset = {
  theme: {
    extend: {
      fontFamily: {
        display: ['Righteous', 'cursive'],
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#080c18',
          card: '#0f1424',
          raised: '#161c32',
          hover: '#1c2440',
        },
        accent: '#fbbf24',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 0.3s ease-out',
        'buzz-shake': 'buzz-shake 0.5s ease-in-out infinite',
        'score-pop': 'score-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'buzz-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        'score-pop': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
};

export default basePreset;
