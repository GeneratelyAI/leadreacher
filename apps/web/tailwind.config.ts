import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        ...defaultTheme.screens,
      },
      colors: {
        "brand-purple": "#5326B7",
        "brand-bg": "#0D0854",
        "brand-purple-light": "#7A58C4",
        "brand-purple-dark": "#24106E",
        "footer-heading": "#5c3a9c",
        "footer-text": "#2d1659",
      },
      maxWidth: {
        "88": "22rem",
      },
      fontFamily: {
        sans: [
          "var(--font-satoshi)",
          "Satoshi",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
