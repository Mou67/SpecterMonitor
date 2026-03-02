/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "glass-border": "rgba(255, 255, 255, 0.08)",
        "glass-bg": "rgba(15, 15, 25, 0.6)",
        "neon-cyan": "#00f0ff",
        "neon-magenta": "#ff00e5",
        "neon-green": "#39ff14",
        "neon-orange": "#ff6a00",
        "neon-red": "#ff073a",
      },
      backdropBlur: {
        glass: "20px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "neon-cyan": "0 0 20px rgba(0, 240, 255, 0.3), 0 0 60px rgba(0, 240, 255, 0.1)",
        "neon-red": "0 0 20px rgba(255, 7, 58, 0.4), 0 0 60px rgba(255, 7, 58, 0.15)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-red": "glowRed 1.5s ease-in-out infinite alternate",
      },
      keyframes: {
        glowRed: {
          "0%": { boxShadow: "0 0 10px rgba(255, 7, 58, 0.2)" },
          "100%": { boxShadow: "0 0 30px rgba(255, 7, 58, 0.6), 0 0 60px rgba(255, 7, 58, 0.3)" },
        },
      },
    },
  },
  plugins: [],
};
