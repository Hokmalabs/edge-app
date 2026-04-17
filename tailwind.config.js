/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        edge: {
          bg: '#050A0E',
          surface: '#0D1821',
          border: '#1A2A38',
          accent: '#00ff87',
          'accent-dim': '#00cc6a',
          muted: '#4A6572',
          text: '#E0F0F8',
          danger: '#ff4d6d',
          warning: '#ffaa00',
          info: '#00b4d8',
        }
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
