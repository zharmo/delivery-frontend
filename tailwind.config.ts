import type { Config } from "tailwindcss";

// Bakhaar's brand colours, same as the customer and seller apps.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0E3B2A", light: "#EAF7EE", tint: "#2C6B44" },
        accent: { DEFAULT: "#F5841F", light: "#FFF1E0", tint: "#D9540F" },
        ink: { DEFAULT: "#14171C", soft: "#3C4149", muted: "#6B7280", faint: "#9AA1AE" },
        line: { DEFAULT: "#EEF0F5", soft: "#F0F1F6" },
        surface: { DEFAULT: "#FFFFFF", page: "#FAFAFB", sunken: "#F9F9FB" },
      },
    },
  },
  plugins: [],
};
export default config;
