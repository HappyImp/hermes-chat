/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0d1117',
        surface: '#161b22',
        border: '#30363d',
        text: '#e6edf3',
        text2: '#8b949e',
        primary: '#58a6ff',
        userBg: '#1f6feb',
        botBg: '#21262d',
        danger: '#f85149',
        success: '#3fb950',
      },
    },
  },
  plugins: [],
};
