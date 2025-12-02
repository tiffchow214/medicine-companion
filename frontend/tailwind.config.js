/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        'soft-teal': '#2BB3B8',
        'warm-green': '#4CAF50',
        'coral': '#F76C5E',
        'slate-blue': '#4F6DF5',
        'pale-teal': '#f7fcfc',
        'light-teal': '#d0ecec',
        'soft-blue': '#e0f2fe',
        'calm-teal': '#ccfbf1',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(15, 23, 42, 0.08)',
        'glass-lg': '0 16px 48px rgba(15, 23, 42, 0.12)',
        'soft': '0 4px 20px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
}

