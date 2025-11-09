// src/theme/theme.js
export const appTheme = {
  ripple: true,

  // Map Tailwind & app.css variables into PrimeReact system tokens
  cssVariables: {
    // === Core Background & Text ===
    "--surface-ground": "var(--color-primary)",      // Background
    "--surface-card": "rgba(255,255,255,0.05)",     // Card surfaces
    "--text-color": "var(--color-text-primary)",     // Primary text
    "--text-color-secondary": "var(--color-text-secondary)",

    // === Primary Palette ===
    "--primary-color": "var(--color-nebula-blue)",
    "--primary-color-text": "#ffffff",

    // === Accents ===
    "--highlight-bg": "rgba(121,232,221,0.2)",
    "--highlight-text-color": "var(--color-text-primary)",
    "--surface-hover": "rgba(255,255,255,0.08)",

    // === Borders & Shadows ===
    "--surface-border": "rgba(255,255,255,0.1)",
    "--surface-overlay": "rgba(255,255,255,0.05)",

    // === Health Indicators ===
    "--color-indicator-nominal": "var(--color-indicator-nominal)",
    "--color-indicator-warning": "var(--color-indicator-warning)",
    "--color-indicator-critical": "var(--color-indicator-critical)",

    // === Fonts ===
    "--font-family": "var(--font-mono)",

    // === Misc ===
    "--focus-ring": "0 0 0 2px var(--color-nebula-cyan)",
  },

  // Global configuration for PrimeReact components
  inputStyle: "filled",
  buttonStyle: "rounded",
  locale: "en",
};
