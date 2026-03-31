export async function loader() {
  return new Response(renderPrivacyPage(), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

function renderPrivacyPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — Carboniq</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #F5F0EB;
      color: #2C2825;
      line-height: 1.7;
      padding: 0;
    }

    .header {
      background: #2C2825;
      color: #F5F0EB;
      padding: 40px 0;
      text-align: center;
    }

    .header h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .header p {
      opacity: 0.7;
      font-size: 0.95rem;
    }

    .container {
      max-width: 780px;
      margin: 0 auto;
      padding: 48px 24px 80px;
    }

    h2 {
      font-size: 1.3rem;
      font-weight: 600;
      color: #4A7C59;
      margin-top: 40px;
      margin-bottom: 12px;
    }

    h3 {
      font-size: 1.05rem;
      font-weight: 600;
      margin-top: 24px;
      margin-bottom: 8px;
    }

    p, li {
      font-size: 0.95rem;
      margin-bottom: 12px;
    }

    ul {
      padding-left: 24px;
      margin-bottom: 16px;
    }

    li {
      margin-bottom: 6px;
    }

    a {
      color: #4A7C59;
      text-decoration: underline;
    }

    .updated {
      background: #fff;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 32px;
      font-size: 0.9rem;
      color: #666;
    }

    .footer {
      text-align: center;
      padding: 32px;
      font-size: 0.85rem;
      color: #999;
      border-top: 1px solid #ddd;
      margin-top: 48px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Carboniq — Privacy Policy</h1>
    <p>Your privacy matters to us</p>
  </div>

  <div class="container">
    <div class="updated">Last updated: March 30, 2026</div>

    <h2>1. Introduction</h2>
    <p>Carboniq ("we", "our", "us") is a Shopify application that helps e-commerce merchants calculate, display, and offset the carbon footprint of their products. This Privacy Policy explains how we collect, use, and protect information when you use our application.</p>

    <h2>2. Information We Collect</h2>

    <h3>2.1 Store Information</h3>
    <p>When you install Carboniq, we access the following data through Shopify's API:</p>
    <ul>
      <li>Store name and domain</li>
      <li>Product catalog data (titles, types, tags, weights)</li>
      <li>Shopify session tokens for authentication</li>
    </ul>

    <h3>2.2 Calculated Data</h3>
    <p>We generate and store the following data:</p>
    <ul>
      <li>Carbon footprint scores for each product (in kgCO₂e)</li>
      <li>Carbon grade classifications (A through E)</li>
      <li>Aggregated store-level carbon statistics</li>
      <li>Carbon offset transaction records</li>
      <li>Impact certificates</li>
    </ul>

    <h3>2.3 Customer Data</h3>
    <p>Carboniq does <strong>not</strong> collect personal data from your customers. The carbon badge displayed on your storefront operates without tracking or collecting visitor information.</p>

    <h2>3. How We Use Your Information</h2>
    <p>We use the collected information solely to:</p>
    <ul>
      <li>Calculate carbon footprint scores for your products using ADEME emission factors</li>
      <li>Display carbon badges on your storefront</li>
      <li>Process carbon offset transactions</li>
      <li>Generate impact certificates and sustainability reports</li>
      <li>Provide analytics and recommendations to reduce your carbon footprint</li>
      <li>Check compliance with EU Green Claims regulations</li>
    </ul>

    <h2>4. Data Storage and Security</h2>
    <p>Your data is stored securely in our PostgreSQL database hosted on Supabase. We implement the following security measures:</p>
    <ul>
      <li>All data is encrypted in transit (TLS/HTTPS)</li>
      <li>Multi-tenant isolation: each store's data is strictly separated</li>
      <li>HMAC signature verification on all webhook endpoints</li>
      <li>Session-based authentication for all admin routes</li>
      <li>No cross-tenant data access is possible</li>
    </ul>

    <h2>5. Data Sharing</h2>
    <p>We do <strong>not</strong> sell, rent, or share your data with third parties. Your data is used exclusively to provide the Carboniq service. The only external data source we use is the ADEME emission factor database for carbon calculations.</p>

    <h2>6. Data Retention</h2>
    <p>We retain your data for as long as the Carboniq app is installed on your store. When you uninstall the app:</p>
    <ul>
      <li>All session data is deleted immediately</li>
      <li>Product carbon scores and store data are permanently removed</li>
      <li>Offset records and certificates are anonymized for legal compliance</li>
    </ul>

    <h2>7. Your Rights</h2>
    <p>You have the right to:</p>
    <ul>
      <li><strong>Access</strong> your data at any time through the Carboniq dashboard</li>
      <li><strong>Export</strong> your carbon data and reports</li>
      <li><strong>Delete</strong> your data by uninstalling the application</li>
      <li><strong>Request</strong> a full data export or deletion by contacting us</li>
    </ul>

    <h2>8. GDPR Compliance</h2>
    <p>Carboniq complies with the General Data Protection Regulation (GDPR). We process data based on the contractual necessity of providing our service. We handle Shopify's mandatory compliance webhooks including:</p>
    <ul>
      <li>Customer data requests</li>
      <li>Customer data erasure (redaction)</li>
      <li>Shop data erasure</li>
    </ul>

    <h2>9. Cookies</h2>
    <p>Carboniq does not use cookies on your storefront. Within the Shopify admin, we use only the session cookies required by Shopify's embedded app framework.</p>

    <h2>10. Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. We will notify merchants of significant changes through the Carboniq dashboard. Continued use of the application after changes constitutes acceptance of the updated policy.</p>

    <h2>11. Contact Us</h2>
    <p>If you have questions about this Privacy Policy or your data, please contact us:</p>
    <ul>
      <li>Email: <a href="mailto:carboncommerce@outlook.com">carboncommerce@outlook.com</a></li>
    </ul>

    <div class="footer">
      &copy; 2026 Carboniq. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}
