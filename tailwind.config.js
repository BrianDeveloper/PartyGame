/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF8E7",
        ink: "#1E1E1E",
        bubblegum: "#FF9FCB",
        mint: "#9CE8C2",
        mustard: "#FFD45C",
        coral: "#FF8D78",
        sky: "#9FD8FF",
      },
      fontFamily: {
        display: ["Fredoka", "ui-rounded", "sans-serif"],
        sans: ["Plus Jakarta Sans", "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        comic: "4px 4px 0px 0px rgba(30,30,30,1)",
        "comic-sm": "3px 3px 0px 0px rgba(30,30,30,1)",
      },
    },
  },
  plugins: [],
};
