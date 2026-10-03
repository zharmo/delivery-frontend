import type { Config } from "tailwindcss";

// Bakhaar Delivery — the driver app's colours.
// brand  = dark green (main buttons, the active trip)
// accent = orange (cash, warnings, "on the way")
// violet = return pickups
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        brand: { DEFAULT: "#0E3B2A", deep: "#0A2C1F", light: "#EAF7EE", mint: "#D6F5E1", tint: "#2C6B44" },
        accent: { DEFAULT: "#F5841F", light: "#FFF1E0", soft: "#FFE3C4", tint: "#D9540F", deep: "#8A3A06" },
        violet: { DEFAULT: "#6E4FE0", light: "#F1EDFD", soft: "#E4DCFB", tint: "#5638C4" },
        danger: { DEFAULT: "#C4362A", light: "#FDEAEA", soft: "#F8D3CF", deep: "#B42318" },
        ink: { DEFAULT: "#14171C", soft: "#3C4149", muted: "#6B7280", faint: "#9AA1AE" },
        line: { DEFAULT: "#EEF0F5", soft: "#F0F1F6" },
        surface: { DEFAULT: "#FFFFFF", page: "#F4F5F9", sunken: "#F4F5F8" },
      },
      boxShadow: {
        card: "0 4px 16px rgba(16,24,32,0.05)",
        float: "0 -6px 20px rgba(16,24,32,0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
