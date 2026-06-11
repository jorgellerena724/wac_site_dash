const PrimeUI = require("tailwindcss-primeui");

module.exports = {
  content: [
    "./src/**/*.{html,ts,css}",
    "./node_modules/primeng/**/*.{html,ts,css}",
  ],
  darkMode: "class", // o 'media' para dark mode automático
  plugins: [PrimeUI], // Prefijo para clases de PrimeNG
};
