/**
 * Convert kg CO₂ to human-readable equivalents.
 * Based on common emission factors from ADEME and other sources.
 */
export function getCarbonEquivalents(
  kgCo2: number,
): Array<{ icon: string; text: string; value: string }> {
  if (kgCo2 <= 0) return [];

  const equivalents: Array<{
    icon: string;
    text: string;
    value: string;
    numericValue: number;
    priority: number;
  }> = [];

  // 🚗 km en voiture — 1 kg CO₂ ≈ 6 km (average car ~166g CO₂/km)
  const kmVoiture = kgCo2 * 6;
  if (kmVoiture >= 0.1) {
    equivalents.push({
      icon: "🚗",
      text: "km en voiture",
      value: formatValue(kmVoiture),
      numericValue: kmVoiture,
      priority: 1,
    });
  }

  // 📺 heures de streaming Netflix — 1 kg CO₂ ≈ 60 heures
  const heuresNetflix = kgCo2 * 60;
  if (heuresNetflix >= 0.1) {
    equivalents.push({
      icon: "📺",
      text: "heures de Netflix",
      value: formatValue(heuresNetflix),
      numericValue: heuresNetflix,
      priority: 3,
    });
  }

  // 💡 heures d'ampoule LED — 1 kg CO₂ ≈ 1000 heures (10W LED, ~1g CO₂/h)
  const heuresLED = kgCo2 * 1000;
  if (heuresLED >= 0.1) {
    equivalents.push({
      icon: "💡",
      text: "heures d'ampoule LED",
      value: formatValue(heuresLED),
      numericValue: heuresLED,
      priority: 5,
    });
  }

  // 🛫 % d'un vol Paris–New York — ~900 kg CO₂ per passenger
  const pctVolParisNY = (kgCo2 / 900) * 100;
  if (pctVolParisNY >= 0.1) {
    equivalents.push({
      icon: "🛫",
      text: "d'un vol Paris–New York",
      value: `${formatValue(pctVolParisNY)}%`,
      numericValue: pctVolParisNY,
      priority: 2,
    });
  }

  // 🥩 steaks de bœuf — ~14 kg CO₂ par steak (250g de bœuf)
  const steaks = kgCo2 / 14;
  if (steaks >= 0.1) {
    equivalents.push({
      icon: "🥩",
      text: "steaks de bœuf",
      value: formatValue(steaks),
      numericValue: steaks,
      priority: 4,
    });
  }

  // 🌳 jours d'absorption par un arbre — 22 kg/an ≈ 0.06 kg/jour
  const joursArbre = kgCo2 / 0.06;
  if (joursArbre >= 0.1) {
    equivalents.push({
      icon: "🌳",
      text: "jours d'absorption par un arbre",
      value: formatValue(joursArbre),
      numericValue: joursArbre,
      priority: 6,
    });
  }

  // 📱 charges de smartphone — ~0.008 kg CO₂ par charge
  const chargesSmartphone = kgCo2 / 0.008;
  if (chargesSmartphone >= 0.1) {
    equivalents.push({
      icon: "📱",
      text: "charges de smartphone",
      value: formatValue(chargesSmartphone),
      numericValue: chargesSmartphone,
      priority: 7,
    });
  }

  // Sort by priority (most impactful/interesting first)
  equivalents.sort((a, b) => a.priority - b.priority);

  return equivalents.map(({ icon, text, value }) => ({ icon, text, value }));
}

/**
 * Format a numeric value for display.
 * Uses locale-appropriate formatting with smart precision.
 */
function formatValue(value: number): string {
  if (value >= 10000) {
    return Math.round(value).toLocaleString("fr-FR");
  }
  if (value >= 100) {
    return Math.round(value).toLocaleString("fr-FR");
  }
  if (value >= 10) {
    return (Math.round(value * 10) / 10).toLocaleString("fr-FR");
  }
  return (Math.round(value * 100) / 100).toLocaleString("fr-FR");
}
