/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        t: {
          bg:      '#070c15',
          surface: '#0c1320',
          card:    '#0f1929',
          border:  '#1a2535',
          hover:   '#162030',
          muted:   '#1f2f44',
        },
        accent: {
          cyan:   '#06d6f0',
          purple: '#8b5cf6',
          blue:   '#3b82f6',
        },
        bull:  '#00d97e',
        bear:  '#ff3e5e',
        warn:  '#f5a623',
        info:  '#60a5fa',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', '1rem'],
      },
      boxShadow: {
        card: '0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.4)',
        glow: '0 0 20px rgba(6,214,240,0.15)',
        'glow-green': '0 0 12px rgba(0,217,126,0.2)',
        'glow-red':   '0 0 12px rgba(255,62,94,0.2)',
      },
      animation: {
        'ticker': 'ticker 60s linear infinite',
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        ticker: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
