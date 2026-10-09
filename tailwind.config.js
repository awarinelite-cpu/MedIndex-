/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  future: {
    // Makes every `hover:` utility apply only on devices with a real
    // mouse (@media (hover: hover) and (pointer: fine)). Without this,
    // tapping a `hover:bg-...` row/button on a touchscreen leaves that
    // hover background "stuck" on (no mouse ever moves away to clear
    // it), which in dark mode showed as a white block hiding the text
    // underneath it until something else was tapped.
    hoverOnlyWhenSupported: true,
  },
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
      // Capsule / tablet shape everywhere: 2rem is >= half the height of any
      // normal button, so short elements become full capsules, while tall
      // cards get large tablet-style corners instead of a distorted pill.
      borderRadius: {
        DEFAULT: '2rem',
        md: '2rem',
        lg: '2rem',
        xl: '2rem',
        '2xl': '2rem',
        '3xl': '2.5rem',
      },
      fontFamily: {
        mono: ['SF Mono', 'Fira Code', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
