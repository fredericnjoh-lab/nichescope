/**
 * Monetization engine — NicheScope's competitive edge.
 * Estimates RPM by vertical + geo, Cash Score for niches, and revenue for channels.
 * Figures are directional industry benchmarks (AdSense), not guarantees.
 */

/** RPM ranges (USD) for long-form AdSense — mid-tier creators */
export const VERTICALS = [
  {
    id: "finance",
    rpm: [14, 32],
    affiliate: true,
    keywords: [
      "finance", "invest", "investment", "stock", "stocks", "crypto", "bitcoin", "trading",
      "tax", "taxes", "mortgage", "insurance", "budget", "wealth", "passive income",
      "retraite", "placement", "bourse", "immobilier", "impot", "épargne", "epargne",
      "dividende", "assurance", "crédit", "credit", "banque", "patrimoine",
    ],
  },
  {
    id: "saas",
    rpm: [10, 24],
    affiliate: true,
    keywords: [
      "software", "saas", "tool", "tools", "app", "apps", "chatgpt", "ai tool",
      "productivity", "notion", "automation", "no code", "nocode", "crm", "api",
      "logiciel", "outil", "productivité", "productivite",
    ],
  },
  {
    id: "business",
    rpm: [8, 18],
    affiliate: true,
    keywords: [
      "business", "entrepreneur", "startup", "marketing", "sales", "side hustle",
      "freelance", "agency", "dropshipping", "ecommerce", "e-commerce", "shopify",
      "entreprise", "entreprendre", "vente", "client", "business model",
    ],
  },
  {
    id: "health",
    rpm: [6, 16],
    affiliate: true,
    keywords: [
      "health", "medical", "doctor", "nutrition", "diet", "supplement", "wellness",
      "mental health", "therapy", "sleep", "santé", "sante", "médecin", "medecin",
      "nutrition", "sommeil", "bien-être", "bien etre",
    ],
  },
  {
    id: "tech",
    rpm: [5, 14],
    affiliate: true,
    keywords: [
      "tech", "gadget", "review", "iphone", "android", "laptop", "pc build",
      "smartphone", "camera", "unboxing", "comparatif", "test", "hardware",
    ],
  },
  {
    id: "education",
    rpm: [4, 10],
    affiliate: false,
    keywords: [
      "learn", "course", "tutorial", "how to", "explained", "study", "exam",
      "apprendre", "cours", "tutoriel", "explication", "formation", "étude", "etude",
    ],
  },
  {
    id: "beauty",
    rpm: [3, 8],
    affiliate: true,
    keywords: [
      "beauty", "makeup", "skincare", "hair", "fashion", "style", "outfit",
      "beauté", "beaute", "maquillage", "soin", "mode",
    ],
  },
  {
    id: "fitness",
    rpm: [2.5, 7],
    affiliate: true,
    keywords: [
      "fitness", "workout", "gym", "muscle", "weight loss", "yoga", "running",
      "musculation", "sport", "entraînement", "entrainement", "perte de poids",
    ],
  },
  {
    id: "gaming",
    rpm: [0.8, 3],
    affiliate: true,
    keywords: [
      "game", "gaming", "gameplay", "fortnite", "minecraft", "valorant", "twitch",
      "jeu", "jeux", "esport", "streamer",
    ],
  },
  {
    id: "entertainment",
    rpm: [1.2, 4],
    affiliate: false,
    keywords: [
      "vlog", "comedy", "funny", "reaction", "prank", "storytime", "drama",
      "divertissement", "humour", "sketch", "réaction", "reaction",
    ],
  },
];

const COUNTRY_MULT = {
  US: 1.0, CA: 0.85, GB: 0.9, AU: 0.85, DE: 0.75, FR: 0.65, NL: 0.8,
  SE: 0.85, CH: 1.05, NO: 0.9, JP: 0.7, KR: 0.55, IN: 0.25, BR: 0.3,
  MX: 0.35, ES: 0.5, IT: 0.5, PL: 0.4, TR: 0.3, ID: 0.2, PH: 0.25,
  NG: 0.2, ZA: 0.35, AE: 0.9, SG: 0.95, NZ: 0.8,
};

const DEFAULT_VERTICAL = {
  id: "general",
  rpm: [1.5, 5],
  affiliate: false,
  keywords: [],
};

export function detectVertical(texts) {
  const blob = (Array.isArray(texts) ? texts.join(" ") : String(texts || "")).toLowerCase();
  let best = DEFAULT_VERTICAL;
  let bestScore = 0;
  for (const v of VERTICALS) {
    let score = 0;
    for (const kw of v.keywords) {
      if (blob.includes(kw.toLowerCase())) score += kw.includes(" ") ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return { ...best, matchScore: bestScore };
}

export function countryMultiplier(code) {
  if (!code) return 0.7;
  return COUNTRY_MULT[String(code).toUpperCase()] ?? 0.55;
}

export function estimateAdsense(views, rpmMin, rpmMax) {
  const v = Math.max(0, Number(views) || 0);
  return {
    min: (v / 1000) * rpmMin,
    max: (v / 1000) * rpmMax,
    mid: (v / 1000) * ((rpmMin + rpmMax) / 2),
  };
}

/**
 * Cash Score 0–100: will this niche make money for a new/growing channel?
 * Combines RPM potential, demand (views/day), opportunity (views/subs), and ease (smaller competitors).
 */
export function scoreCashNiche({
  medViews = 0,
  avgSubs = 0,
  avgVPD = 0,
  count = 1,
  titles = [],
  tags = [],
  region = "",
} = {}) {
  const vertical = detectVertical([...titles, ...tags]);
  const mult = countryMultiplier(region);
  const rpmMin = vertical.rpm[0] * mult;
  const rpmMax = vertical.rpm[1] * mult;

  // Assumed cadence for a serious new channel: 4 long-form / month hitting median
  const monthlyViews = medViews * 4;
  const monthly = estimateAdsense(monthlyViews, rpmMin, rpmMax);

  const rpmScore = Math.min(100, ((rpmMin + rpmMax) / 2 / 20) * 100); // 20 RPM ≈ 100
  const demandScore = Math.min(100, Math.log10(1 + avgVPD) * 25);
  const opportunity = avgSubs > 0 ? medViews / avgSubs : 0;
  const oppScore = Math.min(100, opportunity * 80);
  const easeScore = avgSubs <= 0 ? 50
    : avgSubs < 25_000 ? 95
    : avgSubs < 100_000 ? 75
    : avgSubs < 500_000 ? 50
    : avgSubs < 2_000_000 ? 30
    : 15;
  const depthScore = Math.min(100, count * 12);
  const affiliateBoost = vertical.affiliate ? 8 : 0;

  const cashScore = Math.round(
    Math.min(100,
      rpmScore * 0.32 +
      demandScore * 0.22 +
      oppScore * 0.20 +
      easeScore * 0.16 +
      depthScore * 0.10 +
      affiliateBoost
    )
  );

  return {
    cashScore,
    vertical: vertical.id,
    affiliate: vertical.affiliate,
    rpmMin,
    rpmMax,
    monthlyMin: monthly.min,
    monthlyMax: monthly.max,
    monthlyMid: monthly.mid,
    opportunity,
    easeScore,
    demandScore,
  };
}

/**
 * Channel monetization profile from recent uploads + channel meta.
 */
export function scoreChannelMoney(channel, recent = [], regionHint = "") {
  const stats = channel.statistics || {};
  const sn = channel.snippet || {};
  const subs = parseInt(stats.subscriberCount || 0, 10);
  const totalViews = parseInt(stats.viewCount || 0, 10);
  const videoCount = parseInt(stats.videoCount || 0, 10);
  const country = sn.country || regionHint || "";

  const cutoff = Date.now() - 30 * 86400000;
  const last30 = recent.filter(v => new Date(v.publishedAt).getTime() >= cutoff);
  const longLast30 = last30.filter(v => v.duration >= 60);
  const longViews30 = longLast30.reduce((s, v) => s + v.views, 0);
  const shortsViews30 = last30.filter(v => v.duration > 0 && v.duration < 60)
    .reduce((s, v) => s + v.views, 0);

  const titles = recent.slice(0, 20).map(v => v.title);
  const vertical = detectVertical([sn.title || "", sn.description || "", ...titles]);
  const mult = countryMultiplier(country);
  const rpmMin = vertical.rpm[0] * mult;
  const rpmMax = vertical.rpm[1] * mult;
  // Shorts RPM ~15–25% of long-form
  const shortsRpmMin = rpmMin * 0.15;
  const shortsRpmMax = rpmMax * 0.25;

  const longRev = estimateAdsense(longViews30, rpmMin, rpmMax);
  const shortsRev = estimateAdsense(shortsViews30, shortsRpmMin, shortsRpmMax);
  const monetMin = longRev.min + shortsRev.min;
  const monetMax = longRev.max + shortsRev.max;

  let uploadsPerWeek = 0;
  if (recent.length >= 2) {
    const span = (new Date(recent[0].publishedAt) - new Date(recent[recent.length - 1].publishedAt)) / 86400000;
    uploadsPerWeek = span > 0 ? (recent.length / span) * 7 : 0;
  }

  const avgViews30d = last30.length ? last30.reduce((s, v) => s + v.views, 0) / last30.length : 0;
  const viewsLast30 = last30.reduce((s, v) => s + v.views, 0);
  const medianViews = (() => {
    const arr = recent.map(v => v.views).sort((a, b) => a - b);
    if (!arr.length) return 0;
    const m = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
  })();
  const shortsRatio = recent.length
    ? recent.filter(v => v.duration > 0 && v.duration < 60).length / recent.length
    : 0;

  // YPP proxies (watch hours unavailable via Data API)
  const yppSubsReady = subs >= 500;
  const yppViewsProxy = totalViews >= 50_000 || viewsLast30 >= 8_000;
  const yppLikely = yppSubsReady && yppViewsProxy;

  const viewsPerSub = subs > 0 ? avgViews30d / subs : 0;
  const moneyEfficiency = Math.min(100, viewsPerSub * 120 + (vertical.affiliate ? 10 : 0));

  const cashScore = Math.round(Math.min(100,
    ((monetMax > 0 ? Math.min(100, Math.log10(1 + monetMax) * 28) : 0) * 0.4) +
    (Math.min(100, Math.log10(1 + avgViews30d) * 22) * 0.25) +
    (Math.min(100, viewsPerSub * 100) * 0.2) +
    ((yppLikely ? 80 : yppSubsReady ? 45 : 15) * 0.15)
  ));

  return {
    subs, totalViews, videoCount,
    avgViewsAllTime: videoCount ? totalViews / videoCount : 0,
    uploadsPerWeek, avgViews30d, viewsLast30, last30Count: last30.length,
    medianViews, shortsRatio,
    monetMin, monetMax,
    rpmMin, rpmMax,
    vertical: vertical.id,
    affiliate: vertical.affiliate,
    country,
    yppLikely, yppSubsReady,
    moneyEfficiency,
    cashScore,
    viewsPerSub,
  };
}

/** Preset cash verticals for Studio quick-start */
export const STUDIO_PRESETS = [
  { id: "finance", query: "personal finance investing", labelKey: "preset_finance" },
  { id: "saas", query: "AI tools software review", labelKey: "preset_saas" },
  { id: "business", query: "online business side hustle", labelKey: "preset_business" },
  { id: "health", query: "health nutrition wellness", labelKey: "preset_health" },
  { id: "tech", query: "tech review gadgets", labelKey: "preset_tech" },
  { id: "education", query: "learn programming tutorial", labelKey: "preset_education" },
];
