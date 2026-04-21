/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },
      colors: {
        primary: '#006C6D',
        'primary-dark': '#005556',
        'primary-light': '#E7F3F3',
        accent: '#C9A86A',
        background: '#F7F7F5',
        card: '#FFFFFF',
        border: '#D8DDDA',
        'text-main': '#2F3437',
        'text-soft': '#6E767A',
        success: '#2E7D5A',
        warning: '#C6922D',
        danger: '#A63D4A',
      },
      boxShadow: {
        soft: '0 8px 24px rgba(0, 108, 109, 0.08)',
        card: '0 4px 18px rgba(47, 52, 55, 0.08)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
}