/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c2d3ff',
          300: '#9ab3ff',
          400: '#6d8cf5',
          500: '#4a68e0',
          600: '#3b52c4',
          700: '#2f3f9e',
          800: '#28357f',
          900: '#232f66',
        },
        success: {
          50: '#f0fdf5',
          100: '#dcfce8',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffaeb',
          100: '#fef0c7',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.04)',
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 6px -1px rgb(15 23 42 / 0.06)',
        popover: '0 4px 12px -2px rgb(15 23 42 / 0.12), 0 2px 4px -2px rgb(15 23 42 / 0.08)',
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
}
