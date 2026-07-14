import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        ...defaultTheme.screens,
      },
      colors: {
        onboarding: {
          ink: "#1d2433",
          purple: {
            50: "#faf5ff",
            100: "#f3e8ff",
            200: "#e3d5f5",
            300: "#c4a9e8",
            400: "#7a58c4",
            500: "#5326b7",
            600: "#431e97",
            700: "#24106e",
            800: "#170a5e",
            900: "#0d0854",
          },
          neutral: {
            0: "#ffffff",
            50: "#f8f9fb",
            100: "#f0f2f5",
            150: "#e8ebf0",
            200: "#f1f3f9",
            300: "#c8cdd6",
            400: "#9ba3b0",
            500: "#6b7280",
            600: "#4b5260",
            700: "#353c47",
            750: "#2c323d",
            800: "#222830",
            850: "#1a1f27",
            900: "#141920",
            950: "#0c1017",
            1000: "#000000",
          },
          error: {
            50: "#f5e4e2",
            500: "#ef4444",
            900: "#140605",
          },
          success: {
            50: "#e0f1e6",
            500: "#22c55e",
            900: "#04140a",
          },
          warning: {
            50: "#f2eede",
            150: "#fff1b6",
            500: "#ffd000",
            900: "#141100",
          },
        },
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
        "brand-purple": "#5326B7",
        "brand-bg": "#0D0854",
        "brand-purple-light": "#7A58C4",
        "brand-purple-dark": "#24106E",
        "brand-50": "#faf5ff",
        "brand-100": "#f3e8ff",
        "footer-heading": "#5c3a9c",
        "footer-text": "#2d1659",
        success: {
          50: "#f0fdf4",
          500: "#10b981",
          600: "#059669",
        },
        warning: {
          50: "#fffbeb",
          500: "#f59e0b",
          600: "#d97706",
        },
        error: {
          50: "#fef2f2",
          500: "#ef4444",
          600: "#dc2626",
        },
        info: {
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
        },
      },
      maxWidth: {
        "88": "22rem",
      },
      fontFamily: {
        onboarding: [
          "var(--font-onboarding)",
          "Geist",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        sans: [
          "var(--font-satoshi)",
          "Satoshi",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        onboarding: "0.5rem",
        "onboarding-pill": "4.5rem",
      },
      boxShadow: {
        "onboarding-small": "0 2px 6px -2px rgb(0 0 0 / 0.15)",
        "onboarding-button": "0 4px 12px -3px rgb(0 0 0 / 0.15)",
        "onboarding-normal": "0 2px 16px -5px rgb(0 0 0 / 0.25)",
        "onboarding-tooltip": "0 4px 18px -2px rgb(0 0 0 / 0.15)",
        "onboarding-button-strong": "0 6px 20px -6px rgb(0 0 0 / 0.15)",
        "onboarding-stronger": "0 12px 20px -3px rgb(0 0 0 / 0.15)",
      },
      transitionTimingFunction: {
        brand: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        fast: "160ms",
        base: "240ms",
        slow: "500ms",
        slower: "900ms",
      },
      spacing: {
        "onboarding-1": "0.25rem",
        "onboarding-2": "0.5rem",
        "onboarding-3": "0.75rem",
        "onboarding-4": "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
