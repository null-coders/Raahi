/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F6F1E9',
        sand: { DEFAULT: '#E9DCC6', 50: '#FBF7F1', 100: '#F3EADB', 200: '#E9DCC6', 300: '#D9C3A0' },
        ink: { DEFAULT: '#16233F', 2: '#2B3A5C', soft: '#4A5568', muted: '#8A8F98' },
        gold: { DEFAULT: '#C9965B', soft: '#F2E3CC', deep: '#A8763D' },
        terra: { DEFAULT: '#D9653B', soft: '#F8DFD3' },
        sage: { DEFAULT: '#5E7D5A', soft: '#E3EBDD' },
        sky: { DEFAULT: '#7FA6BF', soft: '#E1ECF3' },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem', '5xl': '2.5rem' },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(22,35,63,.18)',
        lift: '0 30px 60px -20px rgba(22,35,63,.35)',
        glow: '0 0 0 6px rgba(201,150,91,.18)',
      },
      keyframes: {
        kenburns: { '0%': { transform: 'scale(1.05) translate(0,0)' }, '100%': { transform: 'scale(1.18) translate(-2%,-2%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        dash: { to: { strokeDashoffset: '0' } },
      },
      animation: {
        kenburns: 'kenburns 18s ease-out infinite alternate',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
