export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  safelist: [
    { pattern: /^(bg|text|border|ring|hover:bg|focus:ring)-(primary|secondary)-(50|100|200|300|400|500|600|700|800|900)$/ },
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        primary: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87' },
        secondary: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a' },
        brand: {
          purple: '#7F77DD', 'purple-light': '#EEEDFE', 'purple-dark': '#534AB7',
          blue: '#3B8BD4', 'blue-light': '#E6F1FB',
          green: '#1D9E75', 'green-light': '#E1F5EE',
          amber: '#EF9F27', 'amber-light': '#FAEEDA',
          red: '#E24B4A', 'red-light': '#FCEBEB',
          coral: '#D85A30', pink: '#D4537E', teal: '#5DCAA5',
        },
      },
      borderRadius: { '2xl': '16px', '3xl': '24px' },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'glow-purple': '0 0 20px rgba(127,119,221,0.15)',
      },
    }
  },
  plugins: [],
}
