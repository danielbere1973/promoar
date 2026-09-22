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
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "marquee-reverse": {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0)" },
        },
        "light-fade": {
          "0%, 100%": { opacity: "0", transform: "scale(0.85)" },
          "15%, 35%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0", transform: "scale(0.85)" },
        },
      },
      animation: {
        marquee: "marquee 28s linear infinite",
        "marquee-reverse": "marquee-reverse 32s linear infinite",
        "light-fade": "light-fade 10s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
