/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        drug: {
          bg: 'var(--drug-bg)',
          card: 'var(--drug-card)',
          border: 'var(--drug-border)',
          text: 'var(--drug-text)',
          muted: 'var(--drug-muted)',
          accent: '#dc2626',
          success: '#059669',
          warning: '#d97706',
        }
      },
      fontFamily: {
        mono: ['SF Mono', 'Fira Code', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
