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
        // dark midnight palette
        midnight: "#0F0F0F",
        surface: "#141414",
        "surface-2": "#1E1E1E",
        "surface-3": "#2A2A2A",
        border: "#2A2A2A",
        "border-bright": "#3A3A3A",
        fg: "#F5F5F5",
        "fg-muted": "#A0A0A0",
        // accent
        violet: {
          paddy: "#7C3AED",
          light: "#A78BFA",
          dark: "#5B21B6",
        },
        // status
        green:  { paddy: "#4ADE80" },
        red:    { paddy: "#F87171" },
        yellow: { paddy: "#FBBF24", dark: "#D97706" },
        blue:   { paddy: "#60A5FA" },
        // keep coal for borders on light elements
        coal: "#0A0A0A",
        cream: "#F5F5F5",
      },
      fontFamily: {
        grotesk: ["Space Grotesk", "sans-serif"],
        mono:    ["Space Mono", "monospace"],
      },
      boxShadow: {
        brutal:        "4px 4px 0px #7C3AED",
        "brutal-lg":   "6px 6px 0px #7C3AED",
        "brutal-sm":   "2px 2px 0px #7C3AED",
        "brutal-dark": "4px 4px 0px #0A0A0A",
        none:          "none",
      },
      borderWidth: { "3": "3px" },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        "slide-in":  "slideIn 200ms ease-out",
        "fade-in":   "fadeIn 150ms ease-out",
      },
      keyframes: {
        slideIn: {
          "0%":   { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)",   opacity: "1" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
