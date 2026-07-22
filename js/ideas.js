/**
 * Daily ideas + topic tracker engine — pure / testable.
 * Clusters recent video titles into ranked topic ideas (YouTube API proxy).
 */

import { extractTopTerms, tokenize } from "./clustering.js";
import { TOPICS_KEY } from "./constants.js";

const STATUSES = ["idea", "script", "filming", "published"];

function slugTopic(term) {
  return String(term || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "topic";
}

function daysSince(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 30;
  return Math.max(1 / 24, (Date.now() - t) / 86400000);
}

function scoreIdea({ avgVpd, videoCount, channelCount, freshnessDays, termWeight }) {
  const velocity = Math.min(100, Math.log10(1 + avgVpd) * 22);
  const breadth = Math.min(100, videoCount * 12 + channelCount * 8);
  const freshness = Math.max(0, 100 - freshnessDays * 8);
  const weightBoost = Math.min(20, Math.log10(1 + termWeight) * 10);
  // Prefer topics with signal but not already owned by one mega-channel only
  const diversity = channelCount >= 2 ? 12 : channelCount === 1 ? 0 : -5;
  return Math.round(Math.min(100, Math.max(0,
    velocity * 0.4 + breadth * 0.2 + freshness * 0.2 + weightBoost + diversity
  )));
}

function titleAngles(topic, lang) {
  if (lang === "en") {
    return [
      `How to use ${topic} in 2026 (simple playbook)`,
      `${topic}: mistakes that kill growth`,
      `I tested ${topic} for 30 days — results`,
    ];
  }
  return [
    `Comment utiliser ${topic} en 2026 (méthode simple)`,
    `${topic} : les erreurs qui tuent la croissance`,
    `J’ai testé ${topic} pendant 30 jours — résultats`,
  ];
}

/**
 * Build ranked daily topic ideas from a pool of recent videos.
 */
export function buildDailyIdeas({
  videos = [],
  seed = "",
  lang = "fr",
  limit = 12,
} = {}) {
  const enriched = videos
    .filter(v => v && v.title)
    .map(v => ({
      ...v,
      vpd: (v.views || 0) / daysSince(v.publishedAt),
      ageDays: daysSince(v.publishedAt),
    }));

  if (!enriched.length) {
    return { seed, ideas: [], generatedAt: Date.now() };
  }

  const titles = enriched.map(v => v.title);
  const weights = enriched.map(v => v.vpd);
  const terms = extractTopTerms(titles, Math.max(limit * 2, 16), weights);

  const ideas = [];
  for (const [term, termWeight] of terms) {
    if (ideas.length >= limit) break;
    const tokens = new Set(tokenize(term));
    if (!tokens.size) continue;

    const matches = enriched.filter(v => {
      const vt = new Set(tokenize(v.title));
      for (const tok of tokens) {
        if (vt.has(tok)) return true;
      }
      // bigram: require both tokens if multi-word
      if (term.includes(" ")) {
        const lower = v.title.toLowerCase();
        return lower.includes(term.toLowerCase());
      }
      return false;
    });
    if (matches.length < 2) continue;

    const channels = new Set(matches.map(m => m.channelId || m.channelTitle || "").filter(Boolean));
    const avgVpd = matches.reduce((s, m) => s + m.vpd, 0) / matches.length;
    const freshnessDays = Math.min(...matches.map(m => m.ageDays));
    const shorts = matches.filter(m => (m.duration || 120) < 60).length;
    const format = shorts > matches.length / 2 ? "shorts" : "long";
    const ideaScore = scoreIdea({
      avgVpd,
      videoCount: matches.length,
      channelCount: channels.size,
      freshnessDays,
      termWeight,
    });

    const topEvidence = [...matches]
      .sort((a, b) => b.vpd - a.vpd)
      .slice(0, 3)
      .map(m => ({
        id: m.id,
        title: m.title,
        channelTitle: m.channelTitle || "",
        views: m.views || 0,
        vpd: Math.round(m.vpd),
      }));

    ideas.push({
      id: slugTopic(term),
      topic: term,
      score: ideaScore,
      avgVpd: Math.round(avgVpd),
      videoCount: matches.length,
      channelCount: channels.size,
      freshnessDays: Number(freshnessDays.toFixed(1)),
      format,
      angles: titleAngles(term, lang),
      evidence: topEvidence,
      seed: seed || "",
    });
  }

  ideas.sort((a, b) => b.score - a.score);

  // Deduplicate near-identical topics (same slug stem)
  const seen = new Set();
  const unique = [];
  for (const idea of ideas) {
    if (seen.has(idea.id)) continue;
    seen.add(idea.id);
    unique.push(idea);
  }

  return {
    seed,
    ideas: unique.slice(0, limit),
    generatedAt: Date.now(),
    poolSize: enriched.length,
  };
}

export function ideaToRow(idea) {
  return {
    topic: idea.topic,
    score: idea.score,
    avg_views_per_day: idea.avgVpd,
    videos: idea.videoCount,
    channels: idea.channelCount,
    freshness_days: idea.freshnessDays,
    format: idea.format,
    angle_1: idea.angles?.[0] || "",
    angle_2: idea.angles?.[1] || "",
    seed: idea.seed || "",
  };
}

/* ── Topic tracker (localStorage) ─────────────────────────── */

export function getTrackedTopics() {
  try {
    return JSON.parse(localStorage.getItem(TOPICS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveTracked(arr) {
  localStorage.setItem(TOPICS_KEY, JSON.stringify(arr.slice(0, 60)));
}

export function isTopicTracked(topicId) {
  return getTrackedTopics().some(t => t.id === topicId);
}

export function trackTopic(idea, status = "idea") {
  const id = idea.id || slugTopic(idea.topic);
  let arr = getTrackedTopics();
  const idx = arr.findIndex(t => t.id === id);
  const now = Date.now();
  if (idx >= 0) {
    arr[idx] = {
      ...arr[idx],
      topic: idea.topic || arr[idx].topic,
      score: idea.score ?? arr[idx].score,
      format: idea.format || arr[idx].format,
      seed: idea.seed || arr[idx].seed,
      lastSeenAt: now,
      angles: idea.angles || arr[idx].angles,
    };
  } else {
    arr.unshift({
      id,
      topic: idea.topic,
      score: idea.score ?? 0,
      status: STATUSES.includes(status) ? status : "idea",
      format: idea.format || "long",
      seed: idea.seed || "",
      angles: idea.angles || [],
      savedAt: now,
      lastSeenAt: now,
      note: "",
    });
  }
  saveTracked(arr);
  return arr.find(t => t.id === id);
}

export function untrackTopic(topicId) {
  saveTracked(getTrackedTopics().filter(t => t.id !== topicId));
}

export function setTopicStatus(topicId, status) {
  if (!STATUSES.includes(status)) return null;
  const arr = getTrackedTopics();
  const item = arr.find(t => t.id === topicId);
  if (!item) return null;
  item.status = status;
  item.lastSeenAt = Date.now();
  saveTracked(arr);
  return item;
}

export function cycleTopicStatus(topicId) {
  const arr = getTrackedTopics();
  const item = arr.find(t => t.id === topicId);
  if (!item) return null;
  const i = STATUSES.indexOf(item.status);
  item.status = STATUSES[(i + 1) % STATUSES.length];
  item.lastSeenAt = Date.now();
  saveTracked(arr);
  return item;
}

/** Refresh scores on tracked topics that appear in a new ideas batch */
export function syncTrackerScores(ideas = []) {
  const byId = new Map(ideas.map(i => [i.id, i]));
  const arr = getTrackedTopics();
  let changed = false;
  arr.forEach(t => {
    const hit = byId.get(t.id);
    if (hit) {
      t.score = hit.score;
      t.lastSeenAt = Date.now();
      t.format = hit.format || t.format;
      t.angles = hit.angles || t.angles;
      changed = true;
    }
  });
  if (changed) saveTracked(arr);
  return arr;
}

export { STATUSES as TOPIC_STATUSES, slugTopic };
