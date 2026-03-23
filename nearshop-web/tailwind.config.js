export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: {
          purple: '#7F77DD', 'purple-light': '#EEEDFE', 'purple-dark': '#534AB7',
          blue: '#3B8BD4', 'blue-light': '#E6F1FB',
          green: '#1D9E75', 'green-light': '#E1F5EE',
          amber: '#EF9F27', 'amber-light': '#FAEEDA',
          red: '#E24B4A', 'red-light': '#FCEBEB',
          coral: '#D85A30', pink: '#D4537E', teal: '#5DCAA5',
        },
      },
      maxWidth: { '8xl': '1400px' },
      borderRadius: { '2xl': '16px', '3xl': '24px' },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
      },
    }
  },
  plugins: [],
}
