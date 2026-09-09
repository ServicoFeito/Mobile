/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        sf: {
          primary: "#4DAF50",
          secondary: "#70D173",
          tint: "#CBE8CC",
          "dark-green": "#2E7D32",
          text: "#333333",
          body: "#6B6B6B",
          muted: "#9E9E9E",
          favorite: "#E02957",
          bg: "#FAFAFA",
          surface: "#FFFFFF",
          "surface-variant": "#F1F8F1",
          outline: "#E0E0E0",
          "status-yellow": "#FFA000",
          "status-blue": "#1976D2",
          "status-green": "#388E3C",
          "status-red": "#D32F2F",
        },
      },
    },
  },
  plugins: [],
};
