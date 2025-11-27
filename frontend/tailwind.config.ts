import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./styles/**/*.{css}"
  ],
  theme: {
    extend: {
      backgroundImage: {
        "radial-glow":
          "radial-gradient(120% 120% at 50% 0%, rgba(99,102,241,0.25) 0%, rgba(59,130,246,0.2) 45%, rgba(255,255,255,0) 100%)"
      },
      boxShadow: {
        "soft-xl": "0 25px 50px -12px rgba(15, 23, 42, 0.15)"
      }
    }
  },
  plugins: []
};

export default config;
