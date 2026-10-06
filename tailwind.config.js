/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          900: '#140508',
          800: '#22070d',
          700: '#3d141b',
          600: '#8a1323',
        },
        accent: { DEFAULT: '#e6a100', hover: '#c78b00' },
        fm: { main: '#140508', panel: '#22070d', sidebar: '#1a050a', text: '#f5e6e8', muted: '#a68a8e', gold: '#e6a100', red: '#8a1323', border: '#3d141b', success: '#2e7d32' },
        legacyPitch: { 900: '#0a1929', 800: '#0f2438', 700: '#14324a', 600: '#1a405c' },
        legacyAccent: { DEFAULT: '#22c55e', hover: '#16a34a' },
      },
    },
  },
  plugins: [],
};