// ══════════════════════════════════════════════════════
//  CARBONIQ DESIGN SYSTEM — "Bento Nature"
//  Tokens as JS constants for Shopify embedded inline styles
// ══════════════════════════════════════════════════════

export const T = {
  // ── Palette Nature Désaturée ──
  moss50: "#f3f7f0", moss100: "#e3eddc", moss200: "#c4d9b6",
  moss300: "#96ba80", moss400: "#6a9a52", moss500: "#4d7a38",
  moss600: "#3a5e29", moss700: "#2d4920", moss800: "#243a1a",

  stone0: "#fdfcfb", stone50: "#f7f5f3", stone100: "#ede9e4",
  stone200: "#ddd8d0", stone300: "#c4bdb2", stone400: "#a09890",
  stone500: "#7d756c", stone600: "#5e574f", stone700: "#413c36",
  stone800: "#2a2520", stone900: "#1a1612",

  amber100: "#fef3e2", amber400: "#f59e0b", amber600: "#b45309",
  clay100: "#fdeee8", clay400: "#e8714a", clay600: "#b84a26",
  mist100: "#e8f0f7", mist400: "#5b8db8",

  // ── Surfaces ──
  ground: "#f7f5f3",
  base: "#fdfcfb",
  raised: "#ffffff",

  // ── Borders ──
  borderSubtle: "rgba(164,156,144,0.15)",
  borderDefault: "rgba(164,156,144,0.25)",
  borderBrand: "rgba(77,122,56,0.3)",

  // ── Text ──
  textPrimary: "#1a1612",
  textSecondary: "#5e574f",
  textTertiary: "#a09890",
  textBrand: "#3a5e29",

  // ── Shadows ──
  shadowXs: "0 1px 2px rgba(26,22,18,0.06)",
  shadowSm: "0 2px 8px rgba(26,22,18,0.08), 0 0 0 1px rgba(26,22,18,0.04)",
  shadowMd: "0 4px 16px rgba(26,22,18,0.1), 0 0 0 1px rgba(26,22,18,0.05)",

  // ── Radius ──
  rSm: 8, rMd: 12, rLg: 18, rFull: 9999,

  // ── Fonts ──
  serif: "'Instrument Serif', Georgia, serif",
  sans: "'DM Sans', -apple-system, sans-serif",
  mono: "'DM Mono', 'JetBrains Mono', monospace",

  // ── Font links ──
  fontUrl: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap",
} as const;

// ── Label config ──
export const IMPACT = {
  LOW: { color: T.moss600, bg: T.moss50, border: T.moss200, text: "Faible", icon: "🌿", accent: `linear-gradient(90deg, ${T.moss400}, ${T.moss300})` },
  MEDIUM: { color: T.amber600, bg: T.amber100, border: "#fde68a", text: "Modéré", icon: "🍃", accent: `linear-gradient(90deg, ${T.amber400}, #fbbf24)` },
  HIGH: { color: T.clay600, bg: T.clay100, border: "#fed7aa", text: "Élevé", icon: "⚠️", accent: `linear-gradient(90deg, ${T.clay400}, #fb923c)` },
  VERY_HIGH: { color: "#b91c1c", bg: "#fef2f2", border: "#fecaca", text: "Très élevé", icon: "🔴", accent: "linear-gradient(90deg, #ef4444, #f87171)" },
} as const;

// ── Reusable style builders ──
export const S = {
  card: (extra?: React.CSSProperties): React.CSSProperties => ({
    background: T.base,
    border: `1px solid ${T.borderSubtle}`,
    borderRadius: T.rLg,
    overflow: "hidden",
    boxShadow: T.shadowXs,
    ...extra,
  }),

  statCard: (extra?: React.CSSProperties): React.CSSProperties => ({
    background: T.base,
    border: `1px solid ${T.borderSubtle}`,
    borderRadius: T.rLg,
    padding: "22px 24px 18px",
    position: "relative",
    overflow: "hidden",
    boxShadow: T.shadowXs,
    transition: "all 0.12s cubic-bezier(0.4, 0, 0.2, 1)",
    ...extra,
  }),

  accent: (gradient: string): React.CSSProperties => ({
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 3,
    background: gradient,
    borderRadius: `${T.rLg}px ${T.rLg}px 0 0`,
  }),

  label: (): React.CSSProperties => ({
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: T.textTertiary,
    fontFamily: T.sans,
  }),

  heroNum: (color?: string): React.CSSProperties => ({
    fontFamily: T.serif,
    fontSize: 44,
    lineHeight: 1,
    letterSpacing: "-0.03em",
    color: color ?? T.textPrimary,
    fontVariantNumeric: "tabular-nums",
    marginTop: 8,
  }),

  mono: (extra?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: T.mono,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.02em",
    ...extra,
  }),

  pill: (color: string, bg: string, border: string): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 11px",
    borderRadius: T.rFull,
    fontFamily: T.mono,
    fontSize: 12,
    fontWeight: 500,
    color,
    background: bg,
    border: `1px solid ${border}`,
    letterSpacing: "-0.02em",
  }),

  navItem: (): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 14px",
    borderRadius: T.rMd,
    background: T.base,
    border: `1px solid ${T.borderSubtle}`,
    textDecoration: "none",
    color: "inherit",
    transition: "all 0.12s ease",
    boxShadow: T.shadowXs,
    cursor: "pointer",
  }),

  th: (align?: "left" | "right" | "center"): React.CSSProperties => ({
    padding: "10px 20px",
    textAlign: align ?? "left",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: T.textTertiary,
    fontFamily: T.sans,
    borderBottom: `1px solid ${T.borderSubtle}`,
    background: T.stone50,
    whiteSpace: "nowrap",
  }),

  td: (last: boolean): React.CSSProperties => ({
    padding: "13px 20px",
    fontSize: 13.5,
    color: T.textPrimary,
    borderBottom: last ? "none" : `1px solid ${T.borderSubtle}`,
    transition: "background 0.12s ease",
    fontFamily: T.sans,
  }),
};
