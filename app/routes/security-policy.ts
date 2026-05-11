export async function loader() {
  return new Response(renderSecurityPolicy(), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

function renderSecurityPolicy(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Carboniq — Politique de réponse aux incidents de sécurité</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'DM Sans',sans-serif;background:#F5F0EB;color:#2C2825;line-height:1.7;padding:40px 20px}
    .container{max-width:800px;margin:0 auto;background:rgba(253,252,251,.85);backdrop-filter:blur(20px);border-radius:20px;border:1px solid rgba(255,255,255,.6);box-shadow:0 4px 24px rgba(44,40,37,.06);padding:48px}
    h1{font-size:28px;font-weight:700;margin-bottom:8px;color:#2C2825}
    .subtitle{font-size:14px;color:#9C9488;margin-bottom:32px}
    h2{font-size:18px;font-weight:700;color:#4A7C59;margin:28px 0 12px;padding-top:20px;border-top:1px solid rgba(164,156,144,.1)}
    h2:first-of-type{border-top:none;padding-top:0}
    p,li{font-size:14px;color:#3D3833;margin-bottom:8px}
    ul{padding-left:20px;margin-bottom:16px}
    li{margin-bottom:6px}
    strong{color:#2C2825}
    .badge{display:inline-block;padding:4px 12px;border-radius:99px;font-size:11px;font-weight:600;background:rgba(74,124,89,.1);color:#15803D;margin-bottom:24px}
    a{color:#4A7C59;text-decoration:none}
    a:hover{text-decoration:underline}
    .footer{margin-top:32px;padding-top:20px;border-top:1px solid rgba(164,156,144,.1);font-size:12px;color:#9C9488}
  </style>
</head>
<body>
  <div class="container">
    <h1>Politique de réponse aux incidents de sécurité</h1>
    <span class="badge">Carboniq — Version 1.0</span>
    <p class="subtitle">Dernière mise à jour : 1er avril 2026</p>

    <h2>1. Objectif</h2>
    <p>Cette politique définit les procédures de Carboniq pour identifier, évaluer, contenir et résoudre les incidents de sécurité affectant les données des marchands et de leurs clients.</p>

    <h2>2. Définition d'un incident</h2>
    <p>Un incident de sécurité inclut, sans s'y limiter :</p>
    <ul>
      <li>Accès non autorisé aux données des marchands ou de leurs clients</li>
      <li>Fuite ou exposition involontaire de données personnelles</li>
      <li>Compromission de clés API, tokens d'accès ou secrets d'application</li>
      <li>Vulnérabilité exploitée dans l'application ou son infrastructure</li>
      <li>Tentative d'accès cross-tenant (accès aux données d'un autre marchand)</li>
    </ul>

    <h2>3. Niveaux de sévérité</h2>
    <ul>
      <li><strong>Critique</strong> — Fuite de données client, accès non autorisé à la base de données, compromission de secrets. Réponse : immédiate (&lt; 1 heure).</li>
      <li><strong>Élevée</strong> — Vulnérabilité exploitable, accès cross-tenant potentiel, API exposée sans authentification. Réponse : &lt; 4 heures.</li>
      <li><strong>Moyenne</strong> — Faille de sécurité identifiée mais non exploitée, configuration incorrecte. Réponse : &lt; 24 heures.</li>
      <li><strong>Basse</strong> — Amélioration de sécurité recommandée, dépendance vulnérable sans exploit connu. Réponse : &lt; 7 jours.</li>
    </ul>

    <h2>4. Procédure de réponse</h2>
    <p><strong>Phase 1 — Détection et évaluation</strong> (0-1h)</p>
    <ul>
      <li>Identifier la nature et l'étendue de l'incident</li>
      <li>Évaluer le niveau de sévérité</li>
      <li>Documenter les premières observations</li>
    </ul>

    <p><strong>Phase 2 — Confinement</strong> (1-4h)</p>
    <ul>
      <li>Isoler les systèmes affectés</li>
      <li>Révoquer les tokens/clés compromis</li>
      <li>Bloquer les vecteurs d'attaque identifiés</li>
      <li>Activer les sauvegardes si nécessaire</li>
    </ul>

    <p><strong>Phase 3 — Notification</strong> (4-24h)</p>
    <ul>
      <li>Notifier Shopify via le Partner Dashboard</li>
      <li>Notifier les marchands affectés par email</li>
      <li>Pour les incidents critiques : notification dans les 72 heures conformément au RGPD</li>
    </ul>

    <p><strong>Phase 4 — Remédiation</strong> (24-72h)</p>
    <ul>
      <li>Corriger la vulnérabilité à la source</li>
      <li>Déployer le correctif en production</li>
      <li>Vérifier l'absence de persistance de l'attaque</li>
    </ul>

    <p><strong>Phase 5 — Post-mortem</strong> (7 jours)</p>
    <ul>
      <li>Rédiger un rapport d'incident complet</li>
      <li>Identifier les causes racines</li>
      <li>Mettre à jour les mesures préventives</li>
      <li>Communiquer les résultats aux marchands affectés</li>
    </ul>

    <h2>5. Mesures de protection en place</h2>
    <ul>
      <li><strong>Multi-tenant strict</strong> — Toutes les données sont scopées par boutique, aucun accès cross-tenant possible</li>
      <li><strong>Chiffrement</strong> — AES-256-CBC pour les données sensibles (clés API Klaviyo), HTTPS en transit</li>
      <li><strong>Authentification</strong> — OAuth 2.0 Shopify, validation HMAC sur les webhooks, vérification de signature sur les API d'écriture</li>
      <li><strong>Minimisation des données</strong> — Seuls le nom et l'email sont collectés, uniquement pour les certificats d'impact</li>
      <li><strong>Suppression automatique</strong> — Webhook shop/redact supprime toutes les données à la désinstallation</li>
      <li><strong>Conformité RGPD</strong> — Webhooks customers/data_request et customers/redact implémentés</li>
      <li><strong>Emails masqués</strong> — Les adresses email sont masquées dans les API publiques (ex: do***@gmail.com)</li>
      <li><strong>Headers de sécurité</strong> — X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy</li>
    </ul>

    <h2>6. Contact sécurité</h2>
    <p>Pour signaler un incident ou une vulnérabilité :</p>
    <ul>
      <li>Email : <a href="mailto:security@carboniq.app">security@carboniq.app</a></li>
      <li>Réponse garantie sous 24 heures ouvrées</li>
    </ul>

    <div class="footer">
      <p>Carboniq — Application Shopify de bilan carbone CO₂</p>
      <p>Cette politique est révisée et mise à jour au minimum une fois par an.</p>
    </div>
  </div>
</body>
</html>`;
}
