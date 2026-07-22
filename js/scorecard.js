/**
 * Competitor Scorecard engine (vidIQ-style) — pure / testable.
 */

import { extractTopTerms } from "./clustering.js";
import { scoreChannelMoney } from "./money.js";
import { median } from "./utils.js";

/**
 * Build a full scorecard profile for one channel + recent videos.
 */
export function buildChannelScorecard(channel, recent = []) {
  const money = scoreChannelMoney(channel, recent);
  const sn = channel.snippet || {};
  const sorted = [...recent].sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
  );

  const engagementRates = sorted
    .filter(v => v.views > 0)
    .map(v => (v.likes || 0) / v.views);
  const avgEngagement = engagementRates.length
    ? engagementRates.reduce((s, r) => s + r, 0) / engagementRates.length
    : 0;

  // Growth proxy: newest third avg views vs oldest third
  let growthProxy = 0;
  if (sorted.length >= 6) {
    const n = Math.floor(sorted.length / 3);
    const newest = sorted.slice(0, n);
    const oldest = sorted.slice(-n);
    const avgN = newest.reduce((s, v) => s + v.views, 0) / n;
    const avgO = oldest.reduce((s, v) => s + v.views, 0) / n;
    growthProxy = avgO > 0 ? ((avgN - avgO) / avgO) * 100 : 0;
  }

  const med = median(sorted.map(v => v.views));
  const outliers = sorted
    .filter(v => med > 0 && v.views / med >= 3)
    .sort((a, b) => b.views - a.views);

  const topKeywords = extractTopTerms(
    sorted.map(v => v.title),
    8,
    sorted.map(v => v.views)
  ).map(([term, weight]) => ({ term, weight }));

  // Consistency: uploads/week sweet spot 1–5
  const upw = money.uploadsPerWeek || 0;
  const consistency = upw <= 0 ? 20
    : upw < 0.5 ? 40
    : upw <= 5 ? 90
    : upw <= 10 ? 70
    : 45;

  const engagementScore = Math.min(100, avgEngagement * 2000); // 5% ER ≈ 100
  const growthScore = Math.min(100, Math.max(0, 50 + growthProxy / 2));
  const reachScore = Math.min(100, Math.log10(1 + (money.avgViews30d || money.medianViews || 0)) * 22);

  const competitorScore = Math.round(Math.min(100,
    money.cashScore * 0.28 +
    reachScore * 0.22 +
    engagementScore * 0.18 +
    growthScore * 0.16 +
    consistency * 0.16
  ));

  return {
    id: channel.id,
    title: sn.title || "",
    handle: sn.customUrl || "",
    avatar: sn.thumbnails?.default?.url || sn.thumbnails?.medium?.url || "",
    country: sn.country || "",
    publishedAt: sn.publishedAt || "",
    money,
    avgEngagement,
    engagementPct: avgEngagement * 100,
    growthProxy,
    outliers: outliers.slice(0, 5),
    outlierCount: outliers.length,
    topKeywords,
    consistency,
    competitorScore,
    recentCount: sorted.length,
    topVideo: sorted[0] || null,
  };
}

/**
 * Compare multiple scorecards — returns leaders per metric.
 */
export function compareScorecards(cards = []) {
  const valid = cards.filter(Boolean);
  const best = (key, higher = true) => {
    let winner = null;
    let bestVal = higher ? -Infinity : Infinity;
    valid.forEach(c => {
      const v = dig(c, key);
      if (v == null || Number.isNaN(v)) return;
      if (higher ? v > bestVal : v < bestVal) {
        bestVal = v;
        winner = c.id;
      }
    });
    return { id: winner, value: Number.isFinite(bestVal) ? bestVal : null };
  };

  return {
    bestCompetitorScore: best("competitorScore"),
    bestCash: best("money.cashScore"),
    bestSubs: best("money.subs"),
    bestAvg30: best("money.avgViews30d"),
    bestUploads: best("money.uploadsPerWeek"),
    bestEngagement: best("avgEngagement"),
    bestGrowth: best("growthProxy"),
    bestOutliers: best("outlierCount"),
    bestMonet: best("money.monetMax"),
  };
}

function dig(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

/** Flatten for CSV export */
export function scorecardToRow(card) {
  return {
    channel: card.title,
    handle: card.handle,
    competitor_score: card.competitorScore,
    cash_score: card.money.cashScore,
    vertical: card.money.vertical,
    subs: card.money.subs,
    avg_views_30d: Math.round(card.money.avgViews30d),
    median_views: Math.round(card.money.medianViews),
    uploads_per_week: Number(card.money.uploadsPerWeek.toFixed(2)),
    engagement_pct: Number(card.engagementPct.toFixed(2)),
    growth_proxy_pct: Number(card.growthProxy.toFixed(1)),
    outlier_count: card.outlierCount,
    shorts_pct: Math.round(card.money.shortsRatio * 100),
    est_adsense_min: Math.round(card.money.monetMin),
    est_adsense_max: Math.round(card.money.monetMax),
    top_keywords: card.topKeywords.map(k => k.term).join(" | "),
  };
}
