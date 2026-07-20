/**
 * Editorial engine — title/thumbnail briefs + calendar from outlier patterns.
 * Pure functions (no DOM / no API) so they stay testable offline.
 */

import { tokenize, extractTopTerms } from "./clustering.js";

const TITLE_PATTERNS = [
  { id: "number", re: /\b(\d+)\b/, weight: 1.2 },
  { id: "howto", re: /\b(how to|comment|tutoriel|guide|apprendre)\b/i, weight: 1.15 },
  { id: "mistake", re: /\b(mistake|error|wrong|erreur|piège|evite|éviter|stop)\b/i, weight: 1.25 },
  { id: "vs", re: /\b(vs\.?|versus|ou |or )\b/i, weight: 1.1 },
  { id: "secret", re: /\b(secret|hidden|nobody|personne|vraie raison|truth)\b/i, weight: 1.3 },
  { id: "year", re: /\b(202[4-9]|cette année|this year)\b/i, weight: 1.05 },
  { id: "list", re: /\b(top|best|meilleur|meilleurs)\b/i, weight: 1.1 },
];

const HOOKS_FR = {
  number: (topic, n) => `${n} ${topic} que personne n’explique clairement`,
  howto: (topic) => `Comment maîtriser ${topic} (sans perdre 6 mois)`,
  mistake: (topic) => `L’erreur fatale sur ${topic} (à éviter en 2026)`,
  vs: (topic) => `${topic} : ce qui marche vraiment vs ce qu’on te vend`,
  secret: (topic) => `Le secret des chaînes qui monétisent avec ${topic}`,
  year: (topic) => `${topic} en 2026 : la méthode simple qui scale`,
  list: (topic, n) => `Top ${n} idées ${topic} qui rapportent encore`,
  default: (topic) => `${topic} : le playbook pour une chaîne qui paye`,
};

const HOOKS_EN = {
  number: (topic, n) => `${n} ${topic} moves nobody explains clearly`,
  howto: (topic) => `How to master ${topic} without wasting 6 months`,
  mistake: (topic) => `The fatal ${topic} mistake (avoid this in 2026)`,
  vs: (topic) => `${topic}: what actually works vs what’s sold to you`,
  secret: (topic) => `The secret channels use to monetize ${topic}`,
  year: (topic) => `${topic} in 2026: the simple method that scales`,
  list: (topic, n) => `Top ${n} ${topic} ideas that still print money`,
  default: (topic) => `${topic}: the playbook for a channel that pays`,
};

const THUMB_EMOTIONS = ["curiosité", "choc", "urgence", "preuve", "contraste"];
const THUMB_EMOTIONS_EN = ["curiosity", "shock", "urgency", "proof", "contrast"];

function detectPatterns(title) {
  return TITLE_PATTERNS.filter(p => p.re.test(title)).map(p => p.id);
}

function cleanTopic(s) {
  return String(s || "")
    .replace(/[@#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function pickNumber(title, fallback = 7) {
  const m = String(title || "").match(/\b(\d{1,2})\b/);
  if (!m) return fallback;
  const n = parseInt(m[1], 10);
  return n >= 3 && n <= 15 ? n : fallback;
}

/**
 * Analyze a list of outlier videos (with title, views, multiplier, duration).
 */
export function analyzeOutliers(outliers = []) {
  const titles = outliers.map(o => o.title || "").filter(Boolean);
  const patterns = {};
  TITLE_PATTERNS.forEach(p => { patterns[p.id] = 0; });
  outliers.forEach(o => {
    detectPatterns(o.title || "").forEach(id => { patterns[id] = (patterns[id] || 0) + (o.multiplier || 1); });
  });
  const rankedPatterns = Object.entries(patterns)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, weight]) => ({ id, weight }));

  const weights = outliers.map(o => (o.views || 0) * (o.multiplier || 1));
  const topTerms = extractTopTerms(titles, 10, weights).map(([term]) => term);

  const long = outliers.filter(o => (o.duration || 0) >= 60).length;
  const shorts = outliers.filter(o => (o.duration || 0) > 0 && o.duration < 60).length;
  const avgMultiplier = outliers.length
    ? outliers.reduce((s, o) => s + (o.multiplier || 0), 0) / outliers.length
    : 0;

  return {
    count: outliers.length,
    topTerms,
    rankedPatterns,
    preferredFormat: long >= shorts ? "long" : "shorts",
    avgMultiplier,
    sampleTitles: titles.slice(0, 5),
  };
}

function titleFromPattern(patternId, topic, inspiredTitle, lang) {
  const hooks = lang === "en" ? HOOKS_EN : HOOKS_FR;
  const n = pickNumber(inspiredTitle, 7);
  const fn = hooks[patternId] || hooks.default;
  return fn(topic, n);
}

/**
 * Build title briefs inspired by outliers + niche/topic.
 */
export function generateTitleBriefs({
  outliers = [],
  niches = [],
  topic = "",
  lang = "fr",
  count = 6,
} = {}) {
  const analysis = analyzeOutliers(outliers);
  const topics = [
    ...niches.map(n => cleanTopic(n.title || n.id || n)),
    cleanTopic(topic),
    ...analysis.topTerms.slice(0, 3),
  ].filter(Boolean);

  const uniqueTopics = [...new Set(topics)].slice(0, 6);
  if (!uniqueTopics.length) uniqueTopics.push(lang === "en" ? "your niche" : "ta niche");

  const patternOrder = analysis.rankedPatterns.length
    ? analysis.rankedPatterns.map(p => p.id)
    : ["howto", "mistake", "number", "secret", "list", "vs"];

  const angles = lang === "en"
    ? ["(beginner)", "(advanced)", "— case study", "in 10 minutes", "that actually scales"]
    : ["(débutant)", "(avancé)", "— étude de cas", "en 10 minutes", "qui scale vraiment"];

  const briefs = [];
  let i = 0;
  while (briefs.length < count && i < count * 8) {
    const topicI = uniqueTopics[i % uniqueTopics.length];
    const patternId = patternOrder[i % patternOrder.length];
    const inspired = outliers[i % Math.max(1, outliers.length)] || null;
    let title = titleFromPattern(patternId, topicI, inspired?.title, lang);
    // Break collisions by appending a light angle
    if (briefs.some(b => b.title.toLowerCase() === title.toLowerCase())) {
      title = `${title} ${angles[i % angles.length]}`;
    }
    const exists = briefs.some(b => b.title.toLowerCase() === title.toLowerCase());
    if (!exists) {
      briefs.push({
        id: `t${briefs.length + 1}`,
        title,
        pattern: patternId,
        topic: topicI,
        inspiredBy: inspired?.title || null,
        inspiredUrl: inspired?.id ? `https://www.youtube.com/watch?v=${inspired.id}` : null,
        multiplier: inspired?.multiplier || null,
        format: (inspired?.duration || 120) < 60 ? "shorts" : "long",
        score: Math.round(
          55 +
          Math.min(35, (inspired?.multiplier || 3) * 4) +
          (analysis.rankedPatterns.find(p => p.id === patternId) ? 8 : 0)
        ),
      });
    }
    i++;
  }
  return { analysis, briefs };
}

/**
 * Thumbnail brief for a title — overlay text, composition, checklist.
 */
export function generateThumbBrief(titleBrief, lang = "fr") {
  const title = titleBrief?.title || "";
  const tokens = tokenize(title).filter(w => w.length >= 3).slice(0, 4);
  const emotions = lang === "en" ? THUMB_EMOTIONS_EN : THUMB_EMOTIONS;
  const emotion = emotions[(titleBrief?.score || 0) % emotions.length];

  // Overlay: 2–4 punchy words from title
  let overlay = tokens.slice(0, 3).map(w => w.toUpperCase()).join(" ");
  if (!overlay) {
    overlay = lang === "en" ? "DO THIS" : "FAIS ÇA";
  }
  if (overlay.length > 22) overlay = overlay.slice(0, 20) + "…";

  const isShort = titleBrief?.format === "shorts";
  const composition = lang === "en"
    ? (isShort
      ? "Vertical 9:16 — face top third, big text center, object bottom"
      : "16:9 — face on left (⅓), high-contrast object right, text top band")
    : (isShort
      ? "Vertical 9:16 — visage tiers haut, gros texte centre, objet bas"
      : "16:9 — visage à gauche (⅓), objet contraste à droite, bandeau texte haut");

  const colors = lang === "en"
    ? "Yellow/white text on near-black; one accent (red or green) only"
    : "Texte jaune/blanc sur quasi-noir ; un seul accent (rouge ou vert)";

  const checklist = lang === "en"
    ? [
        "Readable at phone size (3 words max on thumb)",
        "One clear emotion on the face",
        "No cluttered background",
        "Subject points / looks toward the text",
        "Before/after or red X vs green check if comparison",
      ]
    : [
        "Lisible en taille téléphone (3 mots max sur la thumb)",
        "Une émotion claire sur le visage",
        "Fond non encombré",
        "Le sujet regarde / pointe vers le texte",
        "Avant/après ou croix rouge vs check vert si comparatif",
      ];

  return {
    overlayText: overlay,
    emotion,
    composition,
    colors,
    checklist,
    pattern: titleBrief?.pattern || "default",
  };
}

/**
 * Build a multi-week editorial calendar from title briefs.
 * @param {object} opts
 * @param {number} opts.perWeek - uploads per week (2–5)
 * @param {number} opts.weeks - horizon
 * @param {Date|string} opts.startDate - first Monday-ish start
 */
export function buildCalendar({
  briefs = [],
  perWeek = 3,
  weeks = 4,
  startDate = new Date(),
  lang = "fr",
} = {}) {
  const start = new Date(startDate);
  start.setHours(12, 0, 0, 0);
  // Snap to next Monday if weekend
  const day = start.getDay();
  if (day === 0) start.setDate(start.getDate() + 1);
  if (day === 6) start.setDate(start.getDate() + 2);

  // Preferred weekdays by cadence
  const slotsByCadence = {
    2: [1, 4],       // Mon, Thu
    3: [1, 3, 5],    // Mon, Wed, Fri
    4: [1, 2, 4, 5], // Mon, Tue, Thu, Fri
    5: [1, 2, 3, 4, 5],
  };
  const weekdays = slotsByCadence[perWeek] || slotsByCadence[3];
  const formatsCycle = perWeek <= 2
    ? ["long", "long"]
    : perWeek === 3
      ? ["long", "shorts", "long"]
      : ["long", "shorts", "long", "shorts", "long"];

  const slots = [];
  let briefIdx = 0;
  for (let w = 0; w < weeks; w++) {
    weekdays.forEach((weekday, si) => {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + (weekday - 1));
      const brief = briefs[briefIdx % Math.max(1, briefs.length)] || null;
      briefIdx++;
      const format = formatsCycle[si % formatsCycle.length];
      const thumb = brief ? generateThumbBrief({ ...brief, format }, lang) : null;
      slots.push({
        week: w + 1,
        date: d.toISOString().slice(0, 10),
        weekday,
        format: brief?.format === "shorts" && format === "shorts" ? "shorts" : format,
        title: brief?.title || (lang === "en" ? "TBD topic" : "Sujet à définir"),
        pattern: brief?.pattern || null,
        topic: brief?.topic || null,
        inspiredBy: brief?.inspiredBy || null,
        inspiredUrl: brief?.inspiredUrl || null,
        score: brief?.score || null,
        thumb,
        status: "planned",
      });
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    perWeek,
    weeks,
    startDate: start.toISOString().slice(0, 10),
    slots,
  };
}

/** Full studio plan package */
export function buildStudioPlan({
  outliers = [],
  niches = [],
  topic = "",
  lang = "fr",
  perWeek = 3,
  weeks = 4,
  titleCount = 8,
} = {}) {
  const { analysis, briefs } = generateTitleBriefs({
    outliers, niches, topic, lang, count: titleCount,
  });
  const briefsWithThumbs = briefs.map(b => ({
    ...b,
    thumb: generateThumbBrief(b, lang),
  }));
  const calendar = buildCalendar({
    briefs: briefsWithThumbs,
    perWeek,
    weeks,
    lang,
  });
  return { analysis, briefs: briefsWithThumbs, calendar };
}
