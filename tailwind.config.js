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
        // ── الألوان الأساسية ──────────────────────────────
        primary:         '#253C32',  // أخضر غابة متوسط
        'primary-dark':  '#14221D',  // أخضر غابة عميق
        'primary-light': '#EBF3EE',  // أخضر فاتح جداً
        accent:          '#5D8A70',  // sage / حكيمي

        // ── لوحة الغابة الكاملة ───────────────────────────
        forest: {
          50:  '#EBF3EE',
          100: '#D7DBDA',
          200: '#BAC7C8',
          300: '#9DA3A1',
          400: '#5D8A70',
          500: '#394F49',
          600: '#253C32',
          700: '#21362C',
          800: '#192922',
          900: '#14221D',
        },

        // ── ألوان الخلفية والحدود ─────────────────────────
        background: '#FAFBFB',
        card:       '#FFFFFF',
        border:     '#D7DBDA',

        // ── النصوص ───────────────────────────────────────
        'text-main': '#14221D',
        'text-soft': '#4B5952',

        // ── حالات العمل ───────────────────────────────────
        success: '#5D8A70',
        warning: '#8B7D6B',
        danger:  '#633646',

        // ── ألوان إضافية من اللوحة ────────────────────────
        sand:     '#C3B39F',
        linen:    '#D1C8B6',
        burgundy: '#633646',
        'cool-gray':'#9DA3A1',
        'slate-g':  '#4B5952',
        'warm-gray':'#BAC7C8',
      },

      boxShadow: {
        soft: '0 8px 24px rgba(20, 34, 29, 0.10)',
        card: '0 2px 12px rgba(20, 34, 29, 0.07)',
        deep: '0 16px 40px rgba(20, 34, 29, 0.15)',
      },

      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
};
