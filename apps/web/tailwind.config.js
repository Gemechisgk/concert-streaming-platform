/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './modules/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#0b0b0b',
        surface: '#141416',
        'surface-raised': '#1c1c20',
        line: '#26262b',
        foreground: '#ffffff',
        muted: '#9ba1a6',
        'polo-red': {
          DEFAULT: '#e50914',
          dark: '#b80710',
          darker: '#8c050c',
          light: '#ff2d3b'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: []
};
