import { BASE_CSS, INIT_SCRIPT } from "../lib/ui/shared-styles";

// ── Page-specific CSS ─────────────────────────────────

const PAGE_CSS = `
/* Method badges */
.cq-method{
  display:inline-flex;align-items:center;padding:3px 10px;
  border-radius:6px;font-family:'DM Mono',monospace;font-size:11px;font-weight:600;
  letter-spacing:.04em;flex-shrink:0;
}
.cq-method-get{background:rgba(74,124,89,.12);color:#15803D}
.cq-method-post{background:rgba(217,119,6,.12);color:#A16207}

/* Endpoint URL */
.cq-url{
  font-family:'DM Mono',monospace;font-size:13px;color:#2C2825;
  word-break:break-all;
}

/* Endpoint header row */
.cq-ep-head{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
}

/* Code block */
.cq-code{
  background:#1E1B18;color:#E8E4DF;border-radius:12px;
  padding:16px 20px;font-family:'DM Mono',monospace;font-size:12px;
  line-height:1.6;overflow-x:auto;white-space:pre;margin-top:12px;
  border:1px solid rgba(255,255,255,.06);
}
.cq-code .cq-key{color:#6BA368}
.cq-code .cq-str{color:#D4A76A}
.cq-code .cq-num{color:#7CB3D4}
.cq-code .cq-comment{color:#6B6560;font-style:italic}

/* Params table */
.cq-params{width:100%;border-collapse:collapse;margin-top:12px}
.cq-params th{
  font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:#9C9488;padding:8px 12px;text-align:left;
  border-bottom:1px solid rgba(164,156,144,.1);
}
.cq-params td{
  padding:8px 12px;font-size:12.5px;color:#3D3833;
  border-bottom:1px solid rgba(164,156,144,.06);
}
.cq-params td:first-child{font-family:'DM Mono',monospace;font-size:12px;color:#4A7C59;white-space:nowrap}
.cq-params td:nth-child(2){font-family:'DM Mono',monospace;font-size:11px;color:#9C9488}

/* Auth badge */
.cq-auth{
  display:inline-flex;align-items:center;gap:5px;padding:3px 10px;
  border-radius:6px;font-size:10.5px;font-weight:600;
  background:rgba(185,28,28,.08);color:#B91C1C;margin-top:8px;
}

/* Endpoint card spacing */
.cq-ep-body{padding:20px 24px}
.cq-ep-section{margin-top:16px}
.cq-ep-section-label{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9C9488;margin-bottom:6px}

/* Intro */
.cq-intro{font-size:13px;color:#3D3833;line-height:1.6;margin-bottom:4px}
.cq-intro-base{
  font-family:'DM Mono',monospace;font-size:12.5px;color:#4A7C59;
  background:rgba(74,124,89,.06);padding:8px 14px;border-radius:8px;
  display:inline-block;margin-top:8px;
}

/* Description text */
.cq-ep-desc{font-size:12.5px;color:#7A746C;margin-top:6px;line-height:1.5}
`;

// ── Endpoints data ────────────────────────────────────

const ENDPOINTS = [
  {
    method: "GET",
    path: "/apps/carboniq/api/carbon-score",
    title: "Get product CO\u2082 score",
    desc: "Returns the calculated carbon footprint, label, and display information for a given product.",
    params: [
      ["shop", "string", "The merchant's myshopify.com domain"],
      ["product_id", "string", "Shopify product ID (numeric or GID)"],
    ],
    response: `{
  <span class="cq-key">"carbonScoreKg"</span>: <span class="cq-num">2.45</span>,
  <span class="cq-key">"carbonLabel"</span>: <span class="cq-str">"LOW"</span>,
  <span class="cq-key">"badge"</span>: <span class="cq-str">"A"</span>,
  <span class="cq-key">"display"</span>: <span class="cq-str">"2.45 kgCO\u2082e"</span>,
  <span class="cq-key">"labelText"</span>: <span class="cq-str">"Faible impact"</span>,
  <span class="cq-key">"locale"</span>: <span class="cq-str">"fr"</span>
}`,
  },
  {
    method: "GET",
    path: "/apps/carboniq/api/carbon-score/widget",
    title: "Get HTML badge widget",
    desc: "Returns a self-contained HTML snippet for the CO\u2082 badge, ready to embed in a storefront.",
    params: [
      ["shop", "string", "The merchant's myshopify.com domain"],
      ["product_id", "string", "Shopify product ID"],
      ["style", "string", "Badge style: pill, leaf, minimal, or detailed"],
    ],
    response: `<span class="cq-comment">&lt;!-- Returns complete HTML with inline styles --&gt;</span>
<span class="cq-str">&lt;div class="carboniq-badge" ...&gt;</span>
  <span class="cq-str">&lt;span class="score"&gt;2.45 kgCO\u2082e&lt;/span&gt;</span>
<span class="cq-str">&lt;/div&gt;</span>`,
  },
  {
    method: "GET",
    path: "/apps/carboniq/api/offset-calculate",
    title: "Calculate offset cost for cart",
    desc: "Calculates the total carbon footprint and offset cost for a set of cart items.",
    params: [
      ["shop", "string", "The merchant's myshopify.com domain"],
      ["items", "JSON", 'Array of items: [{"productId":"123","quantity":2}]'],
    ],
    response: `{
  <span class="cq-key">"totalCarbonKg"</span>: <span class="cq-num">8.72</span>,
  <span class="cq-key">"offsetCostEur"</span>: <span class="cq-num">0.35</span>,
  <span class="cq-key">"breakdown"</span>: [
    { <span class="cq-key">"productId"</span>: <span class="cq-str">"123"</span>, <span class="cq-key">"carbonKg"</span>: <span class="cq-num">4.36</span>, <span class="cq-key">"qty"</span>: <span class="cq-num">2</span> }
  ],
  <span class="cq-key">"equivalents"</span>: {
    <span class="cq-key">"kmCar"</span>: <span class="cq-num">52</span>,
    <span class="cq-key">"smartphoneCharges"</span>: <span class="cq-num">1090</span>
  }
}`,
  },
  {
    method: "POST",
    path: "/apps/carboniq/api/offset-record",
    title: "Record an offset purchase",
    desc: "Records a carbon offset purchase after checkout and generates an impact certificate.",
    params: [
      ["shop", "string", "The merchant's myshopify.com domain"],
      ["orderId", "string", "Shopify order ID"],
      ["orderName", "string", "Order name (e.g. #1042)"],
      ["customerEmail", "string", "Customer email for certificate"],
      ["carbonKg", "number", "Carbon amount to offset in kgCO\u2082e"],
      ["amountEur", "number", "Offset cost in EUR"],
    ],
    response: `{
  <span class="cq-key">"offsetId"</span>: <span class="cq-str">"off_abc123"</span>,
  <span class="cq-key">"certificateCode"</span>: <span class="cq-str">"CIQ-2026-X7K9"</span>,
  <span class="cq-key">"certificateUrl"</span>: <span class="cq-str">"/apps/carboniq/api/certificate/CIQ-2026-X7K9"</span>
}`,
    auth: "HMAC signature required",
  },
  {
    method: "GET",
    path: "/apps/carboniq/api/certificate/:code",
    title: "Get impact certificate",
    desc: "Returns the impact certificate data for a given certificate code.",
    params: [
      [":code", "string", "Certificate code (route parameter)"],
    ],
    response: `{
  <span class="cq-key">"code"</span>: <span class="cq-str">"CIQ-2026-X7K9"</span>,
  <span class="cq-key">"orderId"</span>: <span class="cq-str">"gid://shopify/Order/123"</span>,
  <span class="cq-key">"carbonKg"</span>: <span class="cq-num">8.72</span>,
  <span class="cq-key">"amountEur"</span>: <span class="cq-num">0.35</span>,
  <span class="cq-key">"createdAt"</span>: <span class="cq-str">"2026-03-15T10:30:00Z"</span>,
  <span class="cq-key">"equivalents"</span>: { <span class="cq-key">"trees"</span>: <span class="cq-num">0.4</span>, <span class="cq-key">"kmCar"</span>: <span class="cq-num">52</span> }
}`,
  },
  {
    method: "GET",
    path: "/apps/carboniq/api/impact-portal",
    title: "Get public impact stats",
    desc: "Returns aggregated impact data for the merchant's public impact portal.",
    params: [
      ["shop", "string", "The merchant's myshopify.com domain"],
    ],
    response: `{
  <span class="cq-key">"totalOffset"</span>: <span class="cq-num">1247.5</span>,
  <span class="cq-key">"trees"</span>: <span class="cq-num">32</span>,
  <span class="cq-key">"ocean"</span>: <span class="cq-num">15.6</span>,
  <span class="cq-key">"milestones"</span>: [<span class="cq-str">"1 tonne"</span>, <span class="cq-str">"100 orders"</span>],
  <span class="cq-key">"recentActivity"</span>: [
    { <span class="cq-key">"type"</span>: <span class="cq-str">"offset"</span>, <span class="cq-key">"carbonKg"</span>: <span class="cq-num">4.2</span>, <span class="cq-key">"date"</span>: <span class="cq-str">"2026-03-28"</span> }
  ]
}`,
  },
  {
    method: "GET",
    path: "/apps/carboniq/api/dpp/:productId",
    title: "Digital Product Passport",
    desc: "Returns the EU Digital Product Passport as an HTML page for a given product.",
    params: [
      ["shop", "string", "The merchant's myshopify.com domain"],
      [":productId", "string", "Shopify product ID (route parameter)"],
    ],
    response: `<span class="cq-comment">&lt;!-- Returns a full HTML page --&gt;</span>
<span class="cq-comment">&lt;!-- containing product environmental data, --&gt;</span>
<span class="cq-comment">&lt;!-- carbon score, materials, and supply chain info --&gt;</span>`,
  },
  {
    method: "GET",
    path: "/apps/carboniq/api/impact-stats",
    title: "Aggregated impact data",
    desc: "Returns aggregated carbon impact statistics for the merchant's store.",
    params: [
      ["shop", "string", "The merchant's myshopify.com domain"],
    ],
    response: `{
  <span class="cq-key">"totalProducts"</span>: <span class="cq-num">247</span>,
  <span class="cq-key">"totalCarbonKg"</span>: <span class="cq-num">3842.5</span>,
  <span class="cq-key">"avgCarbonKg"</span>: <span class="cq-num">15.56</span>,
  <span class="cq-key">"totalOffsets"</span>: <span class="cq-num">89</span>,
  <span class="cq-key">"totalOffsetKg"</span>: <span class="cq-num">1247.5</span>
}`,
  },
  {
    method: "GET",
    path: "/apps/carboniq/api/abtest",
    title: "Get A/B test variant",
    desc: "Returns the active A/B test variant for a given test type, used to serve different badge configurations.",
    params: [
      ["shop", "string", "The merchant's myshopify.com domain"],
      ["test_type", "string", "Type of test (e.g. badge_style, badge_position)"],
    ],
    response: `{
  <span class="cq-key">"testId"</span>: <span class="cq-str">"test_abc123"</span>,
  <span class="cq-key">"variant"</span>: <span class="cq-str">"B"</span>,
  <span class="cq-key">"config"</span>: {
    <span class="cq-key">"badgeStyle"</span>: <span class="cq-str">"leaf"</span>,
    <span class="cq-key">"position"</span>: <span class="cq-str">"below_price"</span>
  }
}`,
  },
  {
    method: "GET",
    path: "/apps/carboniq/api/rse-report/:id",
    title: "Get RSE report data",
    desc: "Returns the full RSE/CSR report data for a given report ID.",
    params: [
      [":id", "string", "Report ID (route parameter)"],
    ],
    response: `{
  <span class="cq-key">"id"</span>: <span class="cq-str">"rpt_2026Q1"</span>,
  <span class="cq-key">"period"</span>: <span class="cq-str">"2026-Q1"</span>,
  <span class="cq-key">"totalCarbonKg"</span>: <span class="cq-num">12450</span>,
  <span class="cq-key">"totalOffsetKg"</span>: <span class="cq-num">8200</span>,
  <span class="cq-key">"netCarbonKg"</span>: <span class="cq-num">4250</span>,
  <span class="cq-key">"reductionPct"</span>: <span class="cq-num">12.5</span>,
  <span class="cq-key">"scope3"</span>: { <span class="cq-key">"estimated"</span>: <span class="cq-num">true</span>, <span class="cq-key">"totalKg"</span>: <span class="cq-num">45000</span> }
}`,
  },
  {
    method: "GET",
    path: "/apps/carboniq/api/offset",
    title: "Legacy offset endpoint",
    desc: "Legacy endpoint for retrieving offset and certificate data for an order. Use offset-calculate and offset-record for new integrations.",
    params: [
      ["shop", "string", "The merchant's myshopify.com domain"],
      ["order_id", "string", "Shopify order ID"],
    ],
    response: `{
  <span class="cq-key">"offset"</span>: {
    <span class="cq-key">"carbonKg"</span>: <span class="cq-num">8.72</span>,
    <span class="cq-key">"amountEur"</span>: <span class="cq-num">0.35</span>,
    <span class="cq-key">"status"</span>: <span class="cq-str">"completed"</span>
  },
  <span class="cq-key">"certificate"</span>: {
    <span class="cq-key">"code"</span>: <span class="cq-str">"CIQ-2026-X7K9"</span>,
    <span class="cq-key">"url"</span>: <span class="cq-str">"/apps/carboniq/api/certificate/CIQ-2026-X7K9"</span>
  }
}`,
  },
];

// ── Component ─────────────────────────────────────────

export default function ApiDocs() {
  return (
    <s-page heading="API Documentation">
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />

      <div className="cq-page">
        {/* ── Intro ── */}
        <div className="cq-glass cq-anim" style={{ animationDelay: ".03s" }}>
          <div className="cq-glass-body">
            <div className="cq-intro">
              All public endpoints are accessible via the Shopify App Proxy. Requests must
              pass through your storefront proxy URL. All responses include CORS headers.
            </div>
            <div className="cq-intro-base">
              Base URL: https://your-shop.myshopify.com/apps/carboniq/api/
            </div>
            <div className="cq-ep-desc" style={{ marginTop: "12px" }}>
              11 endpoints available. GET endpoints accept query parameters.
              POST endpoints accept JSON body. All data is scoped to your shop.
            </div>
          </div>
        </div>

        {/* ── Endpoints ── */}
        <div className="cq-sep">
          <span className="cq-sep-text">Endpoints</span>
          <div className="cq-sep-line" />
        </div>

        <div className="cq-stagger">
          {ENDPOINTS.map((ep, i) => (
            <div
              key={i}
              className="cq-glass cq-anim"
              style={{ animationDelay: `${0.06 + i * 0.03}s` }}
            >
              <div className="cq-glass-head">
                <div className="cq-ep-head">
                  <span
                    className={`cq-method ${ep.method === "GET" ? "cq-method-get" : "cq-method-post"}`}
                  >
                    {ep.method}
                  </span>
                  <span className="cq-url">{ep.path}</span>
                </div>
              </div>
              <div className="cq-ep-body">
                <div style={{ fontWeight: 600, fontSize: "14px", color: "#2C2825" }}>
                  {ep.title}
                </div>
                <div className="cq-ep-desc">{ep.desc}</div>

                {ep.auth && <div className="cq-auth">{ep.auth}</div>}

                {/* Parameters */}
                <div className="cq-ep-section">
                  <div className="cq-ep-section-label">Parameters</div>
                  <table className="cq-params">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ep.params.map(([name, type, desc], j) => (
                        <tr key={j}>
                          <td>{name}</td>
                          <td>{type}</td>
                          <td>{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Response */}
                <div className="cq-ep-section">
                  <div className="cq-ep-section-label">Example Response</div>
                  <div
                    className="cq-code"
                    dangerouslySetInnerHTML={{ __html: ep.response }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </s-page>
  );
}
