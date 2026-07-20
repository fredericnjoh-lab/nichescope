/** Run: node --test tests/editorial.test.js */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeOutliers,
  generateTitleBriefs,
  generateThumbBrief,
  buildCalendar,
  buildStudioPlan,
} from "../js/editorial.js";

const OUTLIERS = [
  {
    id: "a1",
    title: "7 Investing Mistakes That Cost Beginners Thousands",
    views: 500000,
    multiplier: 8.2,
    duration: 720,
  },
  {
    id: "a2",
    title: "How to Build Passive Income in 2026 (Simple Guide)",
    views: 320000,
    multiplier: 5.1,
    duration: 840,
  },
  {
    id: "a3",
    title: "Index Funds vs Individual Stocks — The Truth",
    views: 210000,
    multiplier: 4.0,
    duration: 600,
  },
  {
    id: "a4",
    title: "The Secret Nobody Tells You About Dividends",
    views: 180000,
    multiplier: 3.5,
    duration: 55,
  },
];

describe("analyzeOutliers", () => {
  it("detects winning title patterns", () => {
    const a = analyzeOutliers(OUTLIERS);
    assert.ok(a.count === 4);
    assert.ok(a.rankedPatterns.some(p => p.id === "mistake" || p.id === "howto" || p.id === "number"));
    assert.ok(a.avgMultiplier > 3);
    assert.equal(a.preferredFormat, "long");
  });

  it("handles empty input", () => {
    const a = analyzeOutliers([]);
    assert.equal(a.count, 0);
    assert.deepEqual(a.topTerms, []);
  });
});

describe("generateTitleBriefs", () => {
  it("produces unique titles inspired by outliers", () => {
    const { briefs } = generateTitleBriefs({
      outliers: OUTLIERS,
      niches: [{ title: "personal finance" }],
      topic: "investing",
      lang: "en",
      count: 6,
    });
    assert.equal(briefs.length, 6);
    const titles = new Set(briefs.map(b => b.title.toLowerCase()));
    assert.equal(titles.size, 6);
    assert.ok(briefs.every(b => b.pattern && b.score >= 50));
  });

  it("works with niches only (no outliers)", () => {
    const { briefs } = generateTitleBriefs({
      outliers: [],
      niches: [{ title: "outils IA" }],
      lang: "fr",
      count: 4,
    });
    assert.equal(briefs.length, 4);
    assert.ok(briefs.some(b => /ia|outil/i.test(b.title) || /niche/i.test(b.topic)));
  });
});

describe("generateThumbBrief", () => {
  it("returns overlay + checklist", () => {
    const thumb = generateThumbBrief({
      title: "7 Investing Mistakes That Cost Beginners Thousands",
      format: "long",
      score: 80,
      pattern: "mistake",
    }, "en");
    assert.ok(thumb.overlayText.length > 0);
    assert.ok(thumb.checklist.length >= 3);
    assert.ok(thumb.composition.includes("16:9"));
  });
});

describe("buildCalendar", () => {
  it("creates expected number of slots", () => {
    const { briefs } = generateTitleBriefs({
      outliers: OUTLIERS,
      niches: [{ title: "finance" }],
      lang: "fr",
      count: 12,
    });
    const cal = buildCalendar({
      briefs,
      perWeek: 3,
      weeks: 4,
      startDate: "2026-07-20",
      lang: "fr",
    });
    assert.equal(cal.slots.length, 12);
    assert.ok(cal.slots.every(s => s.date && s.title && s.thumb));
    // Mon/Wed/Fri pattern: weekdays 1,3,5
    const week1 = cal.slots.filter(s => s.week === 1);
    assert.equal(week1.length, 3);
  });
});

describe("buildStudioPlan", () => {
  it("returns analysis + briefs + calendar package", () => {
    const plan = buildStudioPlan({
      outliers: OUTLIERS,
      niches: [{ title: "finance perso" }],
      topic: "investissement",
      lang: "fr",
      perWeek: 2,
      weeks: 2,
    });
    assert.ok(plan.analysis.count > 0);
    assert.ok(plan.briefs.length >= 4);
    assert.equal(plan.calendar.slots.length, 4);
    assert.ok(plan.briefs[0].thumb.overlayText);
  });
});
