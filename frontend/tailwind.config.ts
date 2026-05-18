import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "coral-red":  "#E8472A",
        "warm-cream": "#F7F0E3",
        "cream-dark": "#EDE6D3",
        "pure-black": "#0D0D0D",
        "robin-teal": "#4ECDC4",
      },
      fontFamily: {
        space: ["Space Grotesk", "sans-serif"],
        dm:    ["DM Sans",       "sans-serif"],
        mono:  ["Space Mono",    "monospace"],
      },
      boxShadow: {
        "brutal":    "3px 3px 0 #0D0D0D",
        "brutal-sm": "2px 2px 0 #0D0D0D",
        "brutal-lg": "5px 5px 0 #0D0D0D",
        "none":      "none",
      },
      animation: {
        "spin-slow":  "spin 3s linear infinite",
        "pulse-slow": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        slideIn: {
          "0%":   { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
