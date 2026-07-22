/** Run: node --test tests/seo.test.js */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  scoreKeywordOverall,
  scoreVideoSeo,
  generateTags,
  generateTitles,
  parseVideoId,
  extractQuestions,
} from "../js/seo.js";

describe("scoreKeywordOverall", () => {
  it("rewards high views + small competitors", () => {
    const easy = scoreKeywordOverall({
      totalResults: 50_000,
      avgTopSubs: 8_000,
      avgTopViews: 120_000,
      smallChannels: 7,
    });
    const hard = scoreKeywordOverall({
      totalResults: 5_000_000,
      avgTopSubs: 8_000_000,
      avgTopViews: 120_000,
      smallChannels: 0,
    });
    assert.ok(easy.overall > hard.overall);
    assert.ok(easy.competitionScore < hard.competitionScore);
  });
});

describe("scoreVideoSeo", () => {
  it("scores a well-optimized draft higher", () => {
    const good = scoreVideoSeo({
      title: "Personal Finance Tips for Beginners in 2026",
      description: "Learn personal finance tips step by step. https://example.com\n\n" + "More details here. ".repeat(20),
      tags: ["personal finance", "finance tips", "budgeting", "investing", "money", "beginners", "2026", "save money", "wealth", "guide"],
      focusKeyword: "personal finance",
    });
    const bad = scoreVideoSeo({
      title: "HI",
      description: "x",
      tags: [],
      focusKeyword: "personal finance",
    });
    assert.ok(good.score >= 70);
    assert.ok(bad.score < 40);
  });
});

describe("generateTags / titles", () => {
  it("includes the focus keyword in tags", () => {
    const tags = generateTags({ keyword: "ai tools", related: [["chatgpt"]], titles: ["Best AI tools 2026"], lang: "en" });
    assert.ok(tags.includes("ai tools"));
    assert.ok(tags.length >= 5);
  });

  it("generates scored titles", () => {
    const titles = generateTitles({ keyword: "investing", lang: "en", count: 4 });
    assert.equal(titles.length, 4);
    assert.ok(titles.every(t => t.seo && t.title.toLowerCase().includes("investing")));
  });
});

describe("parseVideoId", () => {
  it("parses watch URLs and raw ids", () => {
    assert.equal(parseVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(parseVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(parseVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(parseVideoId("not-a-valid-id"), null);
    assert.equal(parseVideoId("short"), null);
  });
});

describe("extractQuestions", () => {
  it("keeps question-style titles", () => {
    const q = extractQuestions([
      "How to invest in index funds",
      "Best brokers 2026",
      "Pourquoi épargner tôt",
    ]);
    assert.ok(q.some(t => /how/i.test(t)));
    assert.ok(q.some(t => /pourquoi/i.test(t)));
  });
});
