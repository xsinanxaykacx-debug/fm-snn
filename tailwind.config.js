/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          900: '#0a1929',
          800: '#0f2438',
          700: '#14324a',
          600: '#1a405c',
        },
        accent: {
          DEFAULT: '#22c55e',
          hover: '#16a34a',
        },
      },
    },
  },
  plugins: [],
};