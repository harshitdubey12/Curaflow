/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#fafbfc',
          raised: '#ffffff',
          muted: '#f4f6f9',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        accent: {
          50: '#ecfdf5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -6px rgb(15 23 42 / 0.08)',
        card: '0 1px 3px 0 rgb(15 23 42 / 0.05), 0 12px 40px -12px rgb(15 23 42 / 0.12)',
        glow: '0 0 0 1px rgb(59 130 246 / 0.08), 0 12px 48px -8px rgb(37 99 235 / 0.18)',
        'glow-sm': '0 0 24px -4px rgb(59 130 246 / 0.25)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-slow': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in-slow': 'fade-in-slow 0.8s ease-out both',
        float: 'float 5s ease-in-out infinite',
        shimmer: 'shimmer 1.2s ease-in-out infinite',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
