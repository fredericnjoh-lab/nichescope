/**
 * vidIQ-style SEO helpers — keyword overall score, video SEO score,
 * tag / title / description generators. Pure functions (testable).
 */

import { tokenize, extractTopTerms } from "./clustering.js";

const QUESTION_RE = /\b(how|what|why|when|where|which|who|can|should|is|are|do|does|comment|pourquoi|quel|quelle|quels|quelles|est[- ]ce|peut[- ]on|combien|où|ou)\b/i;

/** Bracket label for scores */
export function bracket(score) {
  if (score >= 70) return { label: "High", cls: "high" };
  if (score >= 40) return { label: "Medium", cls: "med" };
  return { label: "Low", cls: "low" };
}

/**
 * Keyword Overall Score (0–100) — proxy for vidIQ overall.
 * Demand ≈ top-video views + market size (totalResults).
 * Opportunity ≈ inverse of competitor channel size + small-channel share.
 */
export function scoreKeywordOverall({
  totalResults = 0,
  avgTopSubs = 0,
  avgTopViews = 0,
  smallChannels = 0,
} = {}) {
  const demandFromViews = Math.min(100, Math.log10(1 + avgTopViews) * 18);
  const demandFromMarket = Math.min(100, Math.log10(1 + totalResults) * 12);
  const volumeScore = Math.round(demandFromViews * 0.65 + demandFromMarket * 0.35);

  // Higher = more competitive (harder)
  let competitionRaw = 50;
  if (avgTopSubs > 5e6) competitionRaw = 95;
  else if (avgTopSubs > 1e6) competitionRaw = 80;
  else if (avgTopSubs > 250000) competitionRaw = 65;
  else if (avgTopSubs > 50000) competitionRaw = 45;
  else if (avgTopSubs > 10000) competitionRaw = 30;
  else competitionRaw = 15;

  // Small channels in top 10 reduce competition
  competitionRaw = Math.max(5, competitionRaw - smallChannels * 4);
  const competitionScore = Math.round(competitionRaw); // high = hard
  const opportunityScore = 100 - competitionScore;

  const overall = Math.round(volumeScore * 0.45 + opportunityScore * 0.55);

  const comp = Math.max(0, Math.min(100, competitionScore));
  return {
    overall: Math.max(0, Math.min(100, overall)),
    volumeScore: Math.max(0, Math.min(100, volumeScore)),
    competitionScore: comp,
    opportunityScore: Math.max(0, Math.min(100, opportunityScore)),
    volumeBracket: bracket(volumeScore),
    // High competition is bad → red (low), low competition → green (high)
    competitionBracket: {
      label: bracket(comp).label,
      cls: comp >= 70 ? "low" : comp >= 40 ? "med" : "high",
    },
    overallBracket: bracket(overall),
  };
}

/**
 * Actionable SEO score for a draft or existing video metadata (0–100).
 * Checks title / description / tags — the part creators control (vidIQ-style).
 */
export function scoreVideoSeo({
  title = "",
  description = "",
  tags = [],
  focusKeyword = "",
} = {}) {
  const checks = [];
  const kw = (focusKeyword || "").trim().toLowerCase();
  const titleL = title.toLowerCase();
  const descL = description.toLowerCase();
  const tagList = (tags || []).map(t => String(t).toLowerCase());
  const tagStr = tagList.join(" ");

  const add = (id, pass, weight, tip) => {
    checks.push({ id, pass, weight, tip, points: pass ? weight : 0 });
  };

  const titleLen = title.trim().length;
  add("title_length", titleLen >= 40 && titleLen <= 70, 12,
    "Title length 40–70 characters");
  add("title_not_empty", titleLen >= 10, 8, "Title is present");
  add("title_keyword", !kw || titleL.includes(kw), 14,
    "Focus keyword appears in the title");
  add("title_caps", title.length > 0 && title !== title.toUpperCase(), 6,
    "Avoid ALL-CAPS titles");

  const descLen = description.trim().length;
  add("desc_length", descLen >= 150, 12, "Description ≥ 150 characters");
  add("desc_keyword", !kw || !descLen || descL.slice(0, 150).includes(kw) || descL.includes(kw), 10,
    "Focus keyword in description (ideally first 150 chars)");
  add("desc_links", !descLen || /https?:\/\//i.test(description) || descLen < 150, 4,
    "Include a link or CTA in the description when possible");

  const tagCount = tagList.filter(Boolean).length;
  add("tags_count", tagCount >= 8 && tagCount <= 25, 12, "Use 8–25 tags");
  add("tags_keyword", !kw || tagList.some(t => t.includes(kw) || kw.includes(t)) || tagStr.includes(kw), 12,
    "Focus keyword (or close variant) in tags");
  add("tags_variety", tagCount === 0 || new Set(tagList).size >= Math.min(5, tagCount), 4,
    "Avoid duplicate tags");

  const max = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + c.points, 0);
  const score = max ? Math.round((earned / max) * 100) : 0;

  return {
    score,
    bracket: bracket(score),
    checks,
    passed: checks.filter(c => c.pass).length,
    total: checks.length,
  };
}

/** Extract question-style titles from a list */
export function extractQuestions(titles = [], limit = 8) {
  return titles
    .filter(t => QUESTION_RE.test(t))
    .slice(0, limit);
}

/**
 * Generate tags from a focus keyword + related terms + sample titles.
 */
export function generateTags({
  keyword = "",
  related = [],
  titles = [],
  lang = "fr",
  max = 18,
} = {}) {
  const kw = keyword.trim();
  const out = [];
  const push = (t) => {
    const s = String(t || "").trim().toLowerCase();
    if (!s || s.length < 2 || s.length > 40) return;
    if (!out.includes(s)) out.push(s);
  };

  push(kw);
  // Variations
  if (kw) {
    if (lang === "fr") {
      push(`comment ${kw}`);
      push(`${kw} tutoriel`);
      push(`${kw} guide`);
      push(`${kw} 2026`);
      push(`meilleur ${kw}`);
    } else {
      push(`how to ${kw}`);
      push(`${kw} tutorial`);
      push(`${kw} guide`);
      push(`${kw} 2026`);
      push(`best ${kw}`);
    }
  }

  related.forEach(r => push(Array.isArray(r) ? r[0] : r));
  extractTopTerms(titles, 12).forEach(([term]) => push(term));

  return out.slice(0, max);
}

/**
 * Suggest titles for a keyword (vidIQ-style generator).
 */
export function generateTitles({ keyword = "", lang = "fr", related = [], count = 6 } = {}) {
  const kw = keyword.trim() || (lang === "en" ? "your topic" : "ton sujet");
  const rel = (related[0] && (Array.isArray(related[0]) ? related[0][0] : related[0])) || "";
  const year = new Date().getFullYear();

  const templatesFr = [
    `${kw} : le guide complet ${year}`,
    `Comment maîtriser ${kw} (sans perdre de temps)`,
    `${kw} — ${rel || "méthode"} qui marche vraiment`,
    `Les erreurs à éviter sur ${kw}`,
    `${kw} pour débutants : tout ce qu’il faut savoir`,
    `Pourquoi ${kw} change la donne en ${year}`,
    `Top idées ${kw} qui convertissent encore`,
    `${kw} vs alternatives : que choisir ?`,
  ];
  const templatesEn = [
    `${kw}: the complete ${year} guide`,
    `How to master ${kw} (without wasting time)`,
    `${kw} — the ${rel || "method"} that actually works`,
    `Mistakes to avoid with ${kw}`,
    `${kw} for beginners: everything you need`,
    `Why ${kw} matters in ${year}`,
    `Top ${kw} ideas that still convert`,
    `${kw} vs alternatives: which should you pick?`,
  ];

  const list = (lang === "en" ? templatesEn : templatesFr).slice(0, count);
  return list.map((title, i) => ({
    title,
    seo: scoreVideoSeo({ title, description: "", tags: [kw], focusKeyword: kw }),
    rank: i + 1,
  }));
}

/**
 * Suggest a description draft with keyword placement.
 */
export function generateDescription({ keyword = "", lang = "fr", title = "" } = {}) {
  const kw = keyword.trim();
  if (lang === "en") {
    return [
      `${title || kw} — in this video you'll learn practical steps around ${kw}.`,
      ``,
      `What you'll get:`,
      `• Clear framework for ${kw}`,
      `• Mistakes to avoid`,
      `• Action checklist`,
      ``,
      `Timestamps:`,
      `0:00 Intro`,
      `0:30 Why ${kw} matters`,
      `2:00 Step-by-step`,
      ``,
      `Resources & links below. Subscribe for more on ${kw}.`,
      ``,
      `#${kw.replace(/\s+/g, "")} #YouTubeSEO`,
    ].join("\n");
  }
  return [
    `${title || kw} — dans cette vidéo, des étapes concrètes autour de ${kw}.`,
    ``,
    `Au programme :`,
    `• Un cadre clair pour ${kw}`,
    `• Les erreurs à éviter`,
    `• Une checklist actionnable`,
    ``,
    `Chapitres :`,
    `0:00 Intro`,
    `0:30 Pourquoi ${kw}`,
    `2:00 Étapes`,
    ``,
    `Ressources en description. Abonne-toi pour plus sur ${kw}.`,
    ``,
    `#${kw.replace(/\s+/g, "")} #YouTubeSEO`,
  ].join("\n");
}

/** Parse YouTube video id from URL or raw id */
export function parseVideoId(raw) {
  const s = String(raw || "").trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const shorts = parts.indexOf("shorts");
      if (shorts >= 0 && /^[\w-]{11}$/.test(parts[shorts + 1] || "")) return parts[shorts + 1];
      const embed = parts.indexOf("embed");
      if (embed >= 0 && /^[\w-]{11}$/.test(parts[embed + 1] || "")) return parts[embed + 1];
    }
  } catch { /* ignore */ }
  return null;
}

export { tokenize };
