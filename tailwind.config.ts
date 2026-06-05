import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          DEFAULT: "#1E3A5F",
          light: "#2D5A8E",
          dark: "#142840",
        },
        accent: {
          DEFAULT: "#D94F2B",
          light: "#E8724F",
          dark: "#B8401F",
        },
      },
    },
  },
  plugins: [],
};
export default config;
