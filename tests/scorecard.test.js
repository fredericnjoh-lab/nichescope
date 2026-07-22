/** Run: node --test tests/scorecard.test.js */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildChannelScorecard,
  compareScorecards,
  scorecardToRow,
} from "../js/scorecard.js";

function makeChannel(id, title, subs = 50_000) {
  return {
    id,
    snippet: {
      title,
      customUrl: `@${title.replace(/\s+/g, "")}`,
      thumbnails: { default: { url: "https://example.com/a.jpg" } },
      country: "US",
      publishedAt: "2020-01-01T00:00:00Z",
    },
    statistics: {
      subscriberCount: String(subs),
      viewCount: String(subs * 100),
      videoCount: "200",
    },
  };
}

function makeVideos(n, { baseViews = 10_000, likesRatio = 0.04 } = {}) {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    const views = Math.round(baseViews * (1 + (n - i) * 0.05));
    return {
      id: `v${i}`,
      title: i % 3 === 0 ? `Personal finance tips ${i}` : `Budget guide ${i}`,
      views,
      likes: Math.round(views * likesRatio),
      comments: 10,
      publishedAt: new Date(now - i * 3 * 86400000).toISOString(),
      durationSec: 600,
    };
  });
}

describe("buildChannelScorecard", () => {
  it("returns competitor score and core metrics", () => {
    const channel = makeChannel("UC1", "Finance Pro", 80_000);
    const recent = makeVideos(12, { baseViews: 40_000 });
    const card = buildChannelScorecard(channel, recent);

    assert.equal(card.id, "UC1");
    assert.equal(card.title, "Finance Pro");
    assert.ok(card.competitorScore >= 0 && card.competitorScore <= 100);
    assert.ok(card.money.cashScore >= 0);
    assert.ok(card.engagementPct >= 0);
    assert.ok(Array.isArray(card.topKeywords));
    assert.ok(card.topKeywords.length > 0);
    assert.ok(typeof card.outlierCount === "number");
  });

  it("flags high-view outliers vs median", () => {
    const channel = makeChannel("UC2", "Burst");
    const recent = makeVideos(9, { baseViews: 5_000 });
    recent[0].views = 200_000; // clear outlier
    const card = buildChannelScorecard(channel, recent);
    assert.ok(card.outlierCount >= 1);
    assert.ok(card.outliers[0].views >= 200_000);
  });

  it("computes positive growth when recent views rise", () => {
    const channel = makeChannel("UC3", "Growing");
    const recent = [];
    const now = Date.now();
    for (let i = 0; i < 9; i++) {
      recent.push({
        id: `g${i}`,
        title: `Growth video ${i}`,
        views: i < 3 ? 50_000 : 5_000, // newest third hotter
        likes: 1000,
        publishedAt: new Date(now - i * 86400000).toISOString(),
        durationSec: 400,
      });
    }
    const card = buildChannelScorecard(channel, recent);
    assert.ok(card.growthProxy > 0);
  });
});

describe("compareScorecards", () => {
  it("picks leaders per metric", () => {
    const a = buildChannelScorecard(makeChannel("A", "Alpha", 10_000), makeVideos(9, { baseViews: 5_000 }));
    const b = buildChannelScorecard(makeChannel("B", "Beta", 200_000), makeVideos(9, { baseViews: 80_000, likesRatio: 0.08 }));
    const leaders = compareScorecards([a, b]);
    assert.equal(leaders.bestSubs.id, "B");
    assert.equal(leaders.bestAvg30.id, "B");
    assert.ok(leaders.bestCompetitorScore.id);
  });
});

describe("scorecardToRow", () => {
  it("flattens for CSV", () => {
    const card = buildChannelScorecard(makeChannel("UC9", "CSV Ch"), makeVideos(6));
    const row = scorecardToRow(card);
    assert.equal(row.channel, "CSV Ch");
    assert.equal(typeof row.competitor_score, "number");
    assert.ok("top_keywords" in row);
  });
});
