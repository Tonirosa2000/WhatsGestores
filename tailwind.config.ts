import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf4",
          100: "#d7f6e4",
          200: "#b2eccb",
          300: "#7edca9",
          400: "#44c382",
          500: "#22a665",
          600: "#16854f",
          700: "#146940",
          800: "#145435",
          900: "#12452d",
          950: "#052718",
        },
        whatsapp: {
          light: "#25D366",
          dark: "#128C7E",
          teal: "#075E54",
        }
      },
    },
  },
  plugins: [],
};
export default config;
