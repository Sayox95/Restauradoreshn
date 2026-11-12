/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marca: {
          50: '#eef5fb',
          100: '#d6e6f4',
          300: '#8fb6dc',
          500: '#2b6cb0',
          600: '#1f5a99',
          700: '#17497f',
          900: '#0f2b46',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        tarjeta: '0 1px 2px rgba(15, 43, 70, 0.06), 0 1px 3px rgba(15, 43, 70, 0.08)',
      },
    },
  },
  plugins: [],
};
