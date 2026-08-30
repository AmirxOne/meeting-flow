import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0d0d0d",
          soft: "#6e6e80",
          faint: "#9b9ba7",
        },
        paper: {
          DEFAULT: "#ffffff",
          soft: "#f7f7f8",
          deep: "#ececf1",
        },
        line: "#e5e5e8",
        danger: "#ef4056",
        success: "#059669",
      },
      fontFamily: {
        sans: ["alibaba", "Tahoma", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
