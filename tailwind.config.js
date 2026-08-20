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
        // ── الهوية الأساسية ───────────────────────────────
        primary:         '#2E6066',  // أساسي — أزرق مخضرّ
        'primary-dark':  '#244E53',  // درجة أغمق (hover/active)
        'primary-light': '#E7F0F0',  // خلفية فاتحة جداً
        accent:          '#C6AA76',  // ثانوي — ذهبي
        'accent-dark':   '#B2925A',

        // ── تدرّج الهوية (أزرق مخضرّ) ──────────────────────
        forest: {
          50:  '#EAF2F2',
          100: '#DCE8E8',
          200: '#C2D6D7',
          300: '#9BB8BA',
          400: '#5A9296',
          500: '#3F7479',
          600: '#2E6066',
          700: '#285459',
          800: '#20454A',
          900: '#173033',
        },

        // ── الخلفية والحدود ───────────────────────────────
        background: '#F7F9F9',
        card:       '#FFFFFF',
        border:     '#E3E7E7',

        // ── النصوص ───────────────────────────────────────
        'text-main': '#1C2E30',
        'text-soft': '#5E6F70',

        // ── حالات العمل (دلالية ضمن الهوية) ───────────────
        success: '#2E6066',  // معتمد/إيجابي — أساسي
        warning: '#B2925A',  // تنبيه — ذهبي غامق
        danger:  '#895B60',  // رفض/حذف — أرجواني داعم

        // ── درجات ذهبية ───────────────────────────────────
        sand:     '#C6AA76',
        linen:    '#DDD0B5',
        burgundy: '#895B60',

        // ── ألوان الدعم (للمسات فقط) ──────────────────────
        'support-blue':  '#385676',
        'support-mauve': '#895B60',
        'support-gray':  '#8A7E78',
        'cool-gray':     '#8A7E78',
        'slate-g':       '#5E6F70',
        'warm-gray':     '#C2D6D7',
      },

      boxShadow: {
        soft: '0 8px 24px rgba(46, 96, 102, 0.10)',
        card: '0 2px 12px rgba(46, 96, 102, 0.07)',
        deep: '0 16px 40px rgba(46, 96, 102, 0.16)',
      },

      borderRadius: {
        xl2: '1rem',
      },

      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn .25s ease both',
        'slide-up': 'slideUp .3s ease both',
        'pop-in': 'popIn .18s ease both',
      },
    },
  },
  plugins: [],
};
