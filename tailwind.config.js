/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        'sparkle-fall': {
          '0%': { transform: 'translateY(-100vh) scale(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(100vh) scale(1)', opacity: '0' },
        },
        'sparkle-fade': {
          '0%, 10%': { opacity: '0' },
          '50%': { opacity: '1' },
          '90%, 100%': { opacity: '0' },
        },
      },
      animation: {
        'sparkle-fall': 'sparkle-fall 3s ease-out infinite',
        'sparkle-fade': 'sparkle-fade 3s ease-out infinite',
      },
    },
  },
  plugins: [],
}
