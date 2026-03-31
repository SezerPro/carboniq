/**
 * Shared Carboniq design system styles.
 * Injected via dangerouslySetInnerHTML on each page (Polaris blocks global CSS).
 *
 * Usage:
 *   <style dangerouslySetInnerHTML={{ __html: BASE_CSS + pageCss }} />
 *   <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
 */

// ── Base CSS — shared across all pages ──────────────────

export const BASE_CSS = `
/* Reset */
.cq-page *{box-sizing:border-box;margin:0;padding:0}
.cq-page{
  font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  color:#2C2825;max-width:1140px;margin:0 auto;position:relative;
}

/* Grain texture */
.cq-page::before{
  content:'';position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.3;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.04'/%3E%3C/svg%3E");
  background-size:128px 128px;
}
.cq-page>*{position:relative;z-index:1}

/* Animations */
@keyframes cqUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes cqFadeIn{from{opacity:0}to{opacity:1}}
@keyframes cqPulse{0%,100%{opacity:.4}50%{opacity:1}}
.cq-anim{opacity:0;animation:cqUp .6s cubic-bezier(.22,1,.36,1) forwards}

/* Glass card */
.cq-glass{
  background:rgba(253,252,251,.7);
  backdrop-filter:blur(20px) saturate(1.4);
  -webkit-backdrop-filter:blur(20px) saturate(1.4);
  border:1px solid rgba(255,255,255,.6);
  border-radius:20px;
  box-shadow:0 0 0 1px rgba(164,156,144,.06),0 1px 2px rgba(44,40,37,.04),0 4px 16px rgba(44,40,37,.04),0 12px 48px rgba(44,40,37,.06);
  overflow:hidden;margin-bottom:16px;
  transition:box-shadow .3s ease;
}
.cq-glass:hover{
  box-shadow:0 0 0 1px rgba(74,124,89,.08),0 2px 4px rgba(44,40,37,.06),0 8px 24px rgba(44,40,37,.06),0 16px 48px rgba(44,40,37,.07);
}

/* Glass card header */
.cq-glass-head{
  padding:18px 24px;border-bottom:1px solid rgba(164,156,144,.08);
  display:flex;align-items:center;gap:10px;
}
.cq-glass-icon{
  width:32px;height:32px;border-radius:10px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;font-size:15px;
}
.cq-glass-title{font-size:14px;font-weight:700;color:#2C2825}
.cq-glass-desc{font-size:11px;color:#9C9488;margin-top:1px}
.cq-glass-body{padding:24px}

/* Metric cards */
.cq-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px}
.cq-metric{
  background:rgba(253,252,251,.7);backdrop-filter:blur(16px) saturate(1.3);
  -webkit-backdrop-filter:blur(16px) saturate(1.3);
  border:1px solid rgba(255,255,255,.6);border-radius:18px;
  padding:22px 24px 18px;position:relative;overflow:hidden;
  box-shadow:0 1px 3px rgba(44,40,37,.04),0 4px 16px rgba(44,40,37,.04);
}
.cq-metric-accent{position:absolute;top:0;left:0;right:0;height:3px}
.cq-metric-label{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9C9488}
.cq-metric-val{
  font-family:'Instrument Serif',Georgia,serif;font-size:36px;line-height:1.1;
  letter-spacing:-.03em;color:#2C2825;margin-top:8px;
}
.cq-metric-val span{font-family:'DM Mono',monospace;font-size:14px;color:#9C9488;margin-left:4px;letter-spacing:0}
.cq-metric-sub{font-size:11px;color:#B8B0A6;margin-top:4px}

/* Section separator */
.cq-sep{display:flex;align-items:center;gap:14px;margin:28px 0 14px}
.cq-sep-text{
  font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:#4A7C59;white-space:nowrap;padding:3px 10px;
  background:rgba(74,124,89,.06);border-radius:6px;
}
.cq-sep-line{flex:1;height:1px;background:linear-gradient(90deg,rgba(74,124,89,.15),transparent)}

/* Table */
.cq-tbl{width:100%;border-collapse:collapse}
.cq-tbl thead th{
  font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:#9C9488;padding:12px 24px;text-align:left;
  background:rgba(74,124,89,.03);border-bottom:1px solid rgba(164,156,144,.08);
}
.cq-tbl tbody tr{transition:all .12s ease}
.cq-tbl tbody tr:nth-child(even){background:rgba(164,156,144,.02)}
.cq-tbl tbody tr:hover{background:rgba(74,124,89,.04)}
.cq-tbl tbody td{padding:13px 24px;font-size:13px;color:#3D3833;border-bottom:1px solid rgba(164,156,144,.05)}
.cq-tbl tbody tr:last-child td{border-bottom:none}

/* Grid */
.cq-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cq-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.cq-grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}

/* Pill badges */
.cq-pill{
  display:inline-flex;align-items:center;gap:5px;padding:4px 12px;
  border-radius:99px;font-size:11px;font-weight:600;
  backdrop-filter:blur(8px);border:1px solid transparent;
}
.cq-pill-green{background:rgba(74,124,89,.1);color:#15803D;border-color:rgba(74,124,89,.12)}
.cq-pill-amber{background:rgba(217,119,6,.1);color:#A16207;border-color:rgba(217,119,6,.1)}
.cq-pill-red{background:rgba(185,28,28,.1);color:#B91C1C;border-color:rgba(185,28,28,.1)}
.cq-pill-blue{background:rgba(59,111,192,.1);color:#3B6FC0;border-color:rgba(59,111,192,.1)}
.cq-pill-gray{background:rgba(164,156,144,.08);color:#7A746C;border-color:rgba(164,156,144,.1)}

/* Buttons */
.cq-btn{
  padding:10px 24px;border-radius:12px;font-family:'DM Sans',sans-serif;
  font-size:13px;font-weight:600;border:none;cursor:pointer;
  transition:all .2s cubic-bezier(.22,1,.36,1);
}
.cq-btn-dark{
  background:#2C2825;color:#FDFCFB;
  box-shadow:0 1px 3px rgba(44,40,37,.1),0 4px 12px rgba(44,40,37,.08);
}
.cq-btn-dark:hover{background:#1E1B18;transform:translateY(-1px);box-shadow:0 2px 6px rgba(44,40,37,.12),0 8px 24px rgba(44,40,37,.1)}
.cq-btn-green{
  background:#4A7C59;color:#FDFCFB;
  box-shadow:0 1px 3px rgba(74,124,89,.15),0 4px 12px rgba(74,124,89,.1);
}
.cq-btn-green:hover{background:#3A6E24;transform:translateY(-1px)}
.cq-btn-ghost{
  background:transparent;color:#9C9488;border:1px solid rgba(164,156,144,.2);
}
.cq-btn-ghost:hover{background:rgba(164,156,144,.06);color:#2C2825}
.cq-btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}

/* Mono values */
.cq-mono{font-family:'DM Mono',monospace;font-variant-numeric:tabular-nums;letter-spacing:-.02em}

/* Display font */
.cq-display{font-family:'Instrument Serif',Georgia,serif;font-weight:400;letter-spacing:-.03em;line-height:1}

/* Label */
.cq-label{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9C9488}

/* Info banner */
.cq-info{
  background:rgba(74,124,89,.05);border:1px solid rgba(74,124,89,.12);
  border-radius:14px;padding:16px 20px;margin-bottom:16px;
  display:flex;gap:12px;align-items:flex-start;
}
.cq-info-icon{font-size:16px;flex-shrink:0;margin-top:1px}
.cq-info-text{font-size:12.5px;color:#3D3833;line-height:1.5}
.cq-info-text strong{font-weight:700;color:#2C2825}

/* Warning banner */
.cq-warn{
  background:rgba(217,119,6,.05);border:1px solid rgba(217,119,6,.12);
  border-radius:14px;padding:16px 20px;margin-bottom:16px;
  display:flex;gap:12px;align-items:flex-start;
}

/* Empty state */
.cq-empty{
  display:flex;flex-direction:column;align-items:center;
  padding:56px 24px;text-align:center;
}
.cq-empty-icon{
  width:56px;height:56px;border-radius:16px;
  background:rgba(74,124,89,.06);border:1px solid rgba(74,124,89,.1);
  display:flex;align-items:center;justify-content:center;
  font-size:24px;margin-bottom:16px;
}
.cq-empty-t{font-size:15px;font-weight:700;color:#2C2825;margin-bottom:4px}
.cq-empty-d{font-size:13px;color:#9C9488;max-width:300px;line-height:1.5}

/* Responsive */
@media(max-width:1024px){.cq-grid-4{grid-template-columns:repeat(2,1fr)}.cq-grid-3{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){.cq-grid-2,.cq-grid-3,.cq-grid-4{grid-template-columns:1fr}}

/* Stagger children */
.cq-stagger>*:nth-child(1){animation-delay:.03s}
.cq-stagger>*:nth-child(2){animation-delay:.06s}
.cq-stagger>*:nth-child(3){animation-delay:.09s}
.cq-stagger>*:nth-child(4){animation-delay:.12s}
.cq-stagger>*:nth-child(5){animation-delay:.15s}
.cq-stagger>*:nth-child(6){animation-delay:.18s}
.cq-stagger>*:nth-child(7){animation-delay:.21s}
.cq-stagger>*:nth-child(8){animation-delay:.24s}
`;

// ── Init script — Polaris override + fonts ──────────────

export const INIT_SCRIPT = `(function(){
  if(document.getElementById('cq-g-override'))return;
  var s=document.createElement('style');s.id='cq-g-override';
  s.textContent='html,body,#app,[data-shopify-app-init]{background:#F5F0EB!important}.Polaris-Frame__Main,.Polaris-Frame{background:#F5F0EB!important}';
  document.head.appendChild(s);
  if(!document.getElementById('cq-g-fonts')){
    var l=document.createElement('link');l.id='cq-g-fonts';l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap';
    document.head.appendChild(l);
  }
})()`;

// ── Color constants ──────────────────────────────────────

export const COLORS = {
  green: "#4A7C59",
  greenLight: "rgba(74,124,89,.08)",
  dark: "#2C2825",
  stone: "#F5F0EB",
  text: "#3D3833",
  textMuted: "#9C9488",
  textFaint: "#B8B0A6",
  border: "rgba(164,156,144,.1)",
  blue: "#3B6FC0",
  blueLight: "rgba(59,111,192,.08)",
  purple: "#6D4DB8",
  purpleLight: "rgba(109,77,184,.08)",
  amber: "#D97706",
  amberLight: "rgba(217,119,6,.08)",
  red: "#B91C1C",
  redLight: "rgba(185,28,28,.08)",
  teal: "#0D8B7E",
  tealLight: "rgba(13,139,126,.08)",
} as const;
