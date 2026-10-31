/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          darkest: '#070a13',
          darker: '#0b1120',
          dark: '#0f172a',
          card: '#131e32',
          border: '#1e293b',
          glow: '#38bdf8'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
};
