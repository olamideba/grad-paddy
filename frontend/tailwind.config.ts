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
        "coral-red": "#E8472A",
        "warm-cream": "#F7F0E3",
        "cream-dark": "#EDE6D3",
        "pure-black": "#0D0D0D",
        "robin-teal": "#4ECDC4",
        // Neobrutalist shell token system (from prototype styles.css oklch values)
        ink: "#1D1A16",
        paper: "#F7F2E8",
        "paper-2": "#FCFAF6",
        "accent-orange": "#E8472A",
        "accent-teal": "#4ECDC4",
        "accent-yellow": "#FBE49A",
        "muted-foreground": "#6F675B",
      },
      fontFamily: {
        space: ["Space Grotesk", "sans-serif"],
        dm: ["DM Sans", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        brutal: "3px 3px 0 #0D0D0D",
        "brutal-sm": "2px 2px 0 #0D0D0D",
        "brutal-lg": "5px 5px 0 #0D0D0D",
        none: "none",
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        "pulse-slow": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
