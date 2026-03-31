import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import type { Alert } from "../lib/notifications/alerts.server";

const ALERT_CSS = `
.cq-alerts{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
.cq-alert{
  display:flex;align-items:flex-start;gap:14px;
  padding:14px 18px;border-radius:14px;
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border:1px solid transparent;
  animation:cqAlertIn .4s cubic-bezier(.22,1,.36,1) both;
  position:relative;
}
@keyframes cqAlertIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

.cq-alert--critical{
  background:rgba(185,28,28,.06);border-color:rgba(185,28,28,.15);
}
.cq-alert--warning{
  background:rgba(217,119,6,.06);border-color:rgba(217,119,6,.15);
}
.cq-alert--info{
  background:rgba(74,124,89,.05);border-color:rgba(74,124,89,.12);
}

.cq-alert-icon{
  width:28px;height:28px;border-radius:8px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;font-size:14px;
}
.cq-alert--critical .cq-alert-icon{background:rgba(185,28,28,.1);color:#B91C1C}
.cq-alert--warning .cq-alert-icon{background:rgba(217,119,6,.1);color:#D97706}
.cq-alert--info .cq-alert-icon{background:rgba(74,124,89,.08);color:#4A7C59}

.cq-alert-content{flex:1;min-width:0}
.cq-alert-title{font-size:13px;font-weight:700;color:#2C2825;margin-bottom:2px}
.cq-alert-msg{font-size:12px;color:#7A746C;line-height:1.4}

.cq-alert-action{
  display:inline-flex;align-items:center;gap:4px;
  margin-top:8px;padding:5px 14px;border-radius:8px;
  font-size:11px;font-weight:600;border:none;cursor:pointer;
  font-family:'DM Sans',sans-serif;transition:all .15s ease;
}
.cq-alert--critical .cq-alert-action{background:#B91C1C;color:#fff}
.cq-alert--critical .cq-alert-action:hover{background:#991B1B}
.cq-alert--warning .cq-alert-action{background:#D97706;color:#fff}
.cq-alert--warning .cq-alert-action:hover{background:#B45309}
.cq-alert--info .cq-alert-action{background:#4A7C59;color:#fff}
.cq-alert--info .cq-alert-action:hover{background:#3A6E24}

.cq-alert-dismiss{
  position:absolute;top:10px;right:10px;
  width:22px;height:22px;border-radius:6px;
  display:flex;align-items:center;justify-content:center;
  background:transparent;border:none;cursor:pointer;
  color:#B8B0A6;font-size:14px;transition:all .15s ease;
}
.cq-alert-dismiss:hover{background:rgba(164,156,144,.1);color:#7A746C}
`;

const SEVERITY_ICONS: Record<string, string> = {
  critical: "⚠",
  warning: "⚡",
  info: "ℹ",
};

export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  // Load dismissed state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cq-dismissed-alerts");
      if (stored) {
        setDismissed(new Set(JSON.parse(stored)));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDismiss = (dismissKey: string) => {
    const next = new Set(dismissed);
    next.add(dismissKey);
    setDismissed(next);
    try {
      localStorage.setItem("cq-dismissed-alerts", JSON.stringify([...next]));
    } catch {
      // ignore
    }
  };

  const visible = alerts.filter((a) => !dismissed.has(a.dismissKey));
  if (visible.length === 0) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ALERT_CSS }} />
      <div className="cq-alerts">
        {visible.map((alert, i) => (
          <div
            key={alert.id}
            className={`cq-alert cq-alert--${alert.severity}`}
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className="cq-alert-icon">{SEVERITY_ICONS[alert.severity]}</div>
            <div className="cq-alert-content">
              <div className="cq-alert-title">{alert.title}</div>
              <div className="cq-alert-msg">{alert.message}</div>
              {alert.action && (
                <button
                  className="cq-alert-action"
                  onClick={() => navigate(alert.action!.url)}
                >
                  {alert.action.label} →
                </button>
              )}
            </div>
            <button
              className="cq-alert-dismiss"
              onClick={() => handleDismiss(alert.dismissKey)}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
