/**
 * Typed references to CSS design tokens.
 * Values live in `styles/tokens.css` - this file is for DX/docs only (no hex duplication).
 */
export const designTokens = {
  color: {
    brand: "var(--brand-purple)",
    brandBg: "var(--brand-bg)",
    ink: "var(--onboarding-ink)",
    success: "var(--color-success)",
    error: "var(--color-error)",
    warning: "var(--color-warning)",
  },
  surface: {
    canvas: "var(--app-canvas)",
    chrome: "var(--app-chrome)",
    elevated: "var(--app-elevated)",
    muted: "var(--app-muted-surface)",
    float: "var(--app-float)",
    border: "var(--app-border)",
    borderStrong: "var(--app-border-strong)",
    fg: "var(--app-fg)",
    fgMuted: "var(--app-fg-muted)",
    fgSubtle: "var(--app-fg-subtle)",
  },
  space: {
    1: "var(--space-1)",
    2: "var(--space-2)",
    3: "var(--space-3)",
    4: "var(--space-4)",
  },
  radius: {
    sm: "var(--ds-radius-sm)",
    md: "var(--ds-radius-md)",
    lg: "var(--ds-radius-lg)",
    pill: "var(--ds-radius-pill)",
  },
  shadow: {
    sm: "var(--shadow-sm)",
    md: "var(--shadow-md)",
    lg: "var(--shadow-lg)",
    float: "var(--shadow-float)",
  },
  motion: {
    fast: "var(--motion-fast)",
    base: "var(--motion-base)",
    slow: "var(--motion-slow)",
    ease: "var(--ease-standard)",
  },
} as const;

export type DesignTokens = typeof designTokens;
