import { useState, useEffect, useCallback } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { getShopImpactStats, getImpactTimeline } from "../lib/impact/impact.server";

// ── Loader ─────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });

  if (!shop) {
    return {
      shop: null,
      stats: null,
      timeline: [],
      trend: [],
      certificates: 0,
      milestones: [],
      portalUrl: "",
    };
  }

  const stats = await getShopImpactStats(shop.id);

  const timeline = await getImpactTimeline(shop.id, 20);

  // Offset stats
  const offsetAgg = await db.carbonOffset.aggregate({
    where: { shopId: shop.id, status: "COMPLETED" },
    _sum: { carbonKg: true },
    _count: true,
  });

  // Certificate count
  const certCount = await db.certificate.count({
    where: { shopId: shop.id },
  });

  // Monthly snapshots
  const snapshots = await db.monthlySnapshot.findMany({
    where: { shopId: shop.id },
    orderBy: { month: "asc" },
    take: 12,
  });

  const trend = snapshots.map((s) => ({
    month: s.month,
    offsetKg: s.totalOffsetKg,
    treesPlanted: s.totalTreesPlanted,
    oceanKg: s.totalOceanKg,
  }));

  // Milestones
  const totalCarbonKg = stats.carbon.totalKg;
  const treesPlanted = stats.trees.totalCount;
  const oceanKg = stats.ocean.totalKg;

  const milestones = [
    { label: "100 kg CO2", target: 100, current: totalCarbonKg, icon: "☁️" },
    { label: "500 kg CO2", target: 500, current: totalCarbonKg, icon: "⛈️" },
    { label: "1 tonne CO2", target: 1000, current: totalCarbonKg, icon: "🌍" },
    { label: "50 arbres", target: 50, current: treesPlanted, icon: "🌳" },
    { label: "100 arbres", target: 100, current: treesPlanted, icon: "🌲" },
    { label: "50 kg plastique", target: 50, current: oceanKg, icon: "🌊" },
  ];

  const appUrl = process.env.SHOPIFY_APP_URL || "";
  const portalUrl = `${appUrl}/api/impact-portal?shop=${encodeURIComponent(shop.shopDomain)}`;

  return {
    shop: {
      name: shop.name ?? shop.shopDomain.replace(".myshopify.com", ""),
      domain: shop.shopDomain,
    },
    stats: {
      totalCarbonKg: stats.carbon.totalKg,
      treesPlanted: stats.trees.totalCount,
      oceanPlasticKg: stats.ocean.totalKg,
      totalOrders: offsetAgg._count,
      totalInvested: stats.totalEur,
    },
    timeline: timeline.map((t) => ({
      id: t.id,
      type: t.type,
      quantity: t.quantity,
      orderId: t.orderId,
      date: t.createdAt.toISOString(),
    })),
    trend,
    certificates: certCount,
    milestones,
    portalUrl,
  };
};

// ── Styles ─────────────────────────────────────────────

const card = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  overflow: "hidden" as const,
};

const gradientCard = {
  ...card,
  background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 40%, #ffffff 100%)",
  border: "1px solid #bbf7d0",
};

// ── Component ──────────────────────────────────────────

export default function ImpactPortal() {
  const { shop, stats, timeline, trend, certificates, milestones, portalUrl } = useLoaderData<typeof loader>();
  const [copied, setCopied] = useState(false);

  const copyUrl = useCallback(() => {
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [portalUrl]);

  if (!shop || !stats) {
    return (
      <s-page heading="Portail d'Impact Public" backAction={{ url: "/app" }}>
        <s-section>
          <s-paragraph>Installez d'abord l'app depuis le dashboard.</s-paragraph>
        </s-section>
      </s-page>
    );
  }

  const maxTrend = Math.max(...trend.map((t) => t.offsetKg), 1);

  return (
    <s-page heading="Portail d'Impact Public" backAction={{ url: "/app" }}>
      {/* ── Public URL bar ── */}
      <div style={{ ...card, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, #16a34a, #15803d)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 20,
          }}>
            {"\uD83C\uDF10"}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>URL publique du portail</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Partagez cette page pour montrer votre impact</div>
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#f9fafb", borderRadius: 10, padding: "10px 14px",
          border: "1px solid #e5e7eb",
        }}>
          <div style={{
            flex: 1, fontSize: 13, color: "#374151", fontFamily: "monospace",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {portalUrl}
          </div>
          <button
            onClick={copyUrl}
            style={{
              padding: "8px 16px", borderRadius: 8,
              background: copied ? "#16a34a" : "linear-gradient(135deg, #16a34a, #15803d)",
              color: "#fff", fontSize: 13, fontWeight: 600,
              border: "none", cursor: "pointer",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {copied ? "Copie !" : "Copier"}
          </button>
        </div>

        {/* Share buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <ShareButton
            label="Twitter"
            color="#1DA1F2"
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Decouvrez notre impact environnemental !`)}&url=${encodeURIComponent(portalUrl)}`}
          />
          <ShareButton
            label="LinkedIn"
            color="#0077B5"
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(portalUrl)}`}
          />
          <ShareButton
            label="Facebook"
            color="#1877F2"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(portalUrl)}`}
          />
        </div>
      </div>

      {/* ── Hero impact counters ── */}
      <div style={{ ...gradientCard, padding: "28px 24px", marginBottom: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>{"\uD83C\uDF31"}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Impact de {shop.name}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Notre engagement pour la planete</div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}>
          <AnimatedCounter
            icon={"\u2601\uFE0F"}
            value={stats.totalCarbonKg}
            suffix=" kg"
            label="CO2 compense"
            color="#16a34a"
          />
          <AnimatedCounter
            icon={"\uD83C\uDF33"}
            value={stats.treesPlanted}
            suffix=""
            label="Arbres plantes"
            color="#15803d"
          />
          <AnimatedCounter
            icon={"\uD83C\uDF0A"}
            value={stats.oceanPlasticKg}
            suffix=" kg"
            label="Plastique ocean"
            color="#0891b2"
          />
          <AnimatedCounter
            icon={"\uD83D\uDCDC"}
            value={certificates}
            suffix=""
            label="Certificats"
            color="#7c3aed"
          />
        </div>

        <div style={{
          display: "flex", justifyContent: "center", gap: 24,
          marginTop: 20, paddingTop: 16,
          borderTop: "1px solid #dcfce7",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{stats.totalOrders}</div>
            <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Commandes</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{stats.totalInvested.toFixed(2)} EUR</div>
            <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Investi</div>
          </div>
        </div>
      </div>

      {/* ── Recent activity feed ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #f3f4f6",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>{"\u26A1"}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Activite recente</span>
        </div>
        <div style={{ padding: "4px 0", maxHeight: 320, overflowY: "auto" }}>
          {timeline.length === 0 && (
            <div style={{ padding: "24px 20px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              Aucune activite pour le moment
            </div>
          )}
          {timeline.slice(0, 10).map((item, i) => {
            const typeInfo = getTypeInfo(item.type);
            const timeAgo = formatTimeAgo(item.date);
            const cities = ["Paris", "Lyon", "Marseille", "Bordeaux", "Toulouse", "Nantes", "Lille", "Strasbourg", "Nice", "Rennes"];
            const names = ["Sarah", "Thomas", "Marie", "Lucas", "Emma", "Hugo", "Lea", "Jules", "Chloe", "Louis"];
            const city = cities[i % cities.length];
            const name = names[i % names.length];

            return (
              <div
                key={item.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 20px",
                  borderBottom: i < 9 ? "1px solid #fafafa" : "none",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: typeInfo.bg, color: typeInfo.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0,
                }}>
                  {typeInfo.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#374151" }}>
                    <strong>{name}</strong> de <strong>{city}</strong> a {typeInfo.verb}{" "}
                    <strong style={{ color: typeInfo.color }}>
                      {item.quantity < 1 ? item.quantity.toFixed(2) : item.quantity.toFixed(1)} {typeInfo.unit}
                    </strong>
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{timeAgo}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Monthly evolution chart ── */}
      {trend.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{
            padding: "16px 20px", borderBottom: "1px solid #f3f4f6",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>{"\uD83D\uDCC8"}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Evolution mensuelle</span>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
              {trend.map((m) => {
                const h = (m.offsetKg / maxTrend) * 100;
                return (
                  <div
                    key={m.month}
                    style={{
                      flex: 1, display: "flex", flexDirection: "column",
                      alignItems: "center", gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {m.offsetKg.toFixed(0)}
                    </span>
                    <div style={{
                      width: "100%", maxWidth: 40, height: `${Math.max(h, 3)}%`,
                      background: "linear-gradient(180deg, #16a34a, #22c55e)",
                      borderRadius: "6px 6px 0 0",
                      transition: "height 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                      position: "relative",
                    }}>
                      {m.treesPlanted > 0 && (
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          height: `${Math.min((m.treesPlanted / Math.max(...trend.map(t => t.treesPlanted), 1)) * 50, 100)}%`,
                          background: "rgba(255,255,255,0.3)",
                          borderRadius: "0 0 0 0",
                        }} />
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>{m.month.slice(5)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{
              display: "flex", justifyContent: "center", gap: 16,
              marginTop: 14, fontSize: 11, color: "#6b7280",
            }}>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#16a34a", marginRight: 4 }} /> CO2 compense (kg)</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Milestones ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #f3f4f6",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>{"\uD83C\uDFC6"}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Jalons</span>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16, padding: 20,
        }}>
          {milestones.map((m) => {
            const pct = Math.min((m.current / m.target) * 100, 100);
            const reached = pct >= 100;
            return (
              <div
                key={m.label}
                style={{
                  textAlign: "center", padding: 16,
                  borderRadius: 12,
                  background: reached ? "#f0fdf4" : "#f9fafb",
                  border: reached ? "1px solid #bbf7d0" : "1px solid #e5e7eb",
                }}
              >
                {/* Progress circle */}
                <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 10px" }}>
                  <svg viewBox="0 0 64 64" style={{ width: 64, height: 64, transform: "rotate(-90deg)" }}>
                    <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                    <circle
                      cx="32" cy="32" r="28" fill="none"
                      stroke={reached ? "#16a34a" : "#9ca3af"}
                      strokeWidth="4"
                      strokeDasharray={`${(pct / 100) * 175.93} 175.93`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, transform: "rotate(0deg)",
                  }}>
                    {reached ? "\u2705" : m.icon}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: reached ? "#16a34a" : "#374151" }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  {reached ? "Atteint !" : `${Math.round(pct)}% — ${formatNum(m.current)}/${formatNum(m.target)}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </s-page>
  );
}

// ── Sub-components ─────────────────────────────────────

function AnimatedCounter({ icon, value, suffix, label, color }: {
  icon: string; value: number; suffix: string; label: string; color: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1200;
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return (
    <div style={{
      background: "rgba(255,255,255,0.8)",
      borderRadius: 14, padding: "18px 14px",
      textAlign: "center", border: "1px solid #dcfce7",
      backdropFilter: "blur(4px)",
    }}>
      <div style={{ fontSize: 26, marginBottom: 4 }}>{icon}</div>
      <div style={{
        fontSize: 28, fontWeight: 800, color,
        fontVariantNumeric: "tabular-nums", lineHeight: 1.2,
      }}>
        {formatNum(display)}{suffix}
      </div>
      <div style={{
        fontSize: 11, color: "#6b7280", fontWeight: 500,
        textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 4,
      }}>
        {label}
      </div>
    </div>
  );
}

function ShareButton({ label, color, href }: { label: string; color: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 14px", borderRadius: 8,
        backgroundColor: color, color: "#fff",
        fontSize: 12, fontWeight: 600,
        textDecoration: "none",
        transition: "opacity 0.2s",
      }}
      onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "0.85"; }}
      onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = "1"; }}
    >
      {label}
    </a>
  );
}

// ── Helpers ────────────────────────────────────────────

function formatNum(n: number): string {
  if (n < 1) return n.toFixed(2);
  if (n < 10) return n.toFixed(1);
  return Math.round(n).toString();
}

function getTypeInfo(type: string) {
  switch (type) {
    case "CARBON":
      return { icon: "\u2601\uFE0F", color: "#16a34a", bg: "#dcfce7", verb: "compense", unit: "kg CO2" };
    case "TREE":
      return { icon: "\uD83C\uDF33", color: "#15803d", bg: "#d1fae5", verb: "plante", unit: "arbre(s)" };
    case "OCEAN":
      return { icon: "\uD83C\uDF0A", color: "#0891b2", bg: "#cffafe", verb: "retire", unit: "kg plastique" };
    default:
      return { icon: "\u2728", color: "#6b7280", bg: "#f3f4f6", verb: "contribue", unit: "" };
  }
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "A l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Il y a ${days}j`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
