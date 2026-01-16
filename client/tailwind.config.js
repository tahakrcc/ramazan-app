/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          400: '#E6C86E',
          500: '#D4AF37', // Classic Gold
          600: '#AA8C2C',
        },
        dark: {
          800: '#232323',
          900: '#1a1a1a', // Deep Black/Gray
          950: '#121212',
        },
        primary: '#D4AF37', // Gold as primary
        secondary: '#1a1a1a', // Dark as secondary
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      backgroundImage: {
        'luxury-pattern': "url('https://www.transparenttextures.com/patterns/cubes.png')", // Optional subtle texture
      }
    },
  },
  plugins: [],
}
