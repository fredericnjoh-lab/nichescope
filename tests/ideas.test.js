/** Run: node --test tests/ideas.test.js */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildDailyIdeas,
  ideaToRow,
  trackTopic,
  untrackTopic,
  isTopicTracked,
  cycleTopicStatus,
  syncTrackerScores,
  getTrackedTopics,
  slugTopic,
} from "../js/ideas.js";

// Minimal localStorage for tracker tests
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => { store.clear(); },
};

function makeVideos() {
  const now = Date.now();
  const titles = [
    "Personal finance tips for beginners 2026",
    "Personal finance budget mistakes",
    "How I invest with personal finance apps",
    "Budget guide for beginners",
    "Budget guide that actually works",
    "AI tools for creators 2026",
    "Best AI tools for YouTube",
    "AI tools review for beginners",
  ];
  return titles.map((title, i) => ({
    id: `v${i}`,
    title,
    channelTitle: `Ch${i % 3}`,
    channelId: `UC${i % 3}`,
    views: 20_000 + i * 5_000,
    publishedAt: new Date(now - (i + 1) * 2 * 86400000).toISOString(),
    duration: i % 4 === 0 ? 45 : 600,
  }));
}

describe("buildDailyIdeas", () => {
  it("clusters related titles into scored topics", () => {
    const pack = buildDailyIdeas({ videos: makeVideos(), seed: "finance", lang: "en", limit: 10 });
    assert.ok(pack.ideas.length >= 1);
    assert.ok(pack.ideas.every(i => i.score >= 0 && i.score <= 100));
    assert.ok(pack.ideas.every(i => i.angles.length >= 2));
    assert.ok(pack.ideas[0].evidence.length >= 1);
  });

  it("returns empty ideas for empty pool", () => {
    const pack = buildDailyIdeas({ videos: [] });
    assert.equal(pack.ideas.length, 0);
  });
});

describe("ideaToRow", () => {
  it("flattens for CSV", () => {
    const pack = buildDailyIdeas({ videos: makeVideos(), lang: "en" });
    const row = ideaToRow(pack.ideas[0]);
    assert.ok(row.topic);
    assert.equal(typeof row.score, "number");
  });
});

describe("topic tracker", () => {
  beforeEach(() => { store.clear(); });

  it("tracks, cycles status, and untracks", () => {
    const idea = { id: slugTopic("personal finance"), topic: "personal finance", score: 72, format: "long", angles: ["a"] };
    trackTopic(idea);
    assert.equal(isTopicTracked(idea.id), true);
    assert.equal(getTrackedTopics()[0].status, "idea");

    cycleTopicStatus(idea.id);
    assert.equal(getTrackedTopics()[0].status, "script");

    untrackTopic(idea.id);
    assert.equal(isTopicTracked(idea.id), false);
  });

  it("syncs scores from a new ideas batch", () => {
    const idea = { id: "budget-guide", topic: "budget guide", score: 40, format: "long" };
    trackTopic(idea);
    syncTrackerScores([{ id: "budget-guide", topic: "budget guide", score: 88, format: "long", angles: [] }]);
    assert.equal(getTrackedTopics()[0].score, 88);
  });
});
