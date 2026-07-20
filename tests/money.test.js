/** Run: node --test tests/money.test.js */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectVertical,
  scoreCashNiche,
  scoreChannelMoney,
  countryMultiplier,
  estimateAdsense,
} from "../js/money.js";

describe("detectVertical", () => {
  it("detects finance from investing keywords", () => {
    const v = detectVertical(["Best index funds for beginners", "stock market investing"]);
    assert.equal(v.id, "finance");
    assert.ok(v.rpm[0] >= 10);
  });

  it("detects gaming", () => {
    const v = detectVertical(["Fortnite gameplay season", "valorant tips"]);
    assert.equal(v.id, "gaming");
  });

  it("falls back to general", () => {
    const v = detectVertical(["hello world random xyz"]);
    assert.equal(v.id, "general");
  });
});

describe("scoreCashNiche", () => {
  it("scores finance niches higher than gaming at similar views", () => {
    const finance = scoreCashNiche({
      medViews: 50000,
      avgSubs: 80000,
      avgVPD: 2000,
      count: 5,
      titles: ["how to invest in stocks", "passive income portfolio"],
      region: "US",
    });
    const gaming = scoreCashNiche({
      medViews: 50000,
      avgSubs: 80000,
      avgVPD: 2000,
      count: 5,
      titles: ["fortnite gameplay tips", "minecraft survival"],
      region: "US",
    });
    assert.ok(finance.cashScore > gaming.cashScore);
    assert.ok(finance.monthlyMid > gaming.monthlyMid);
    assert.equal(finance.vertical, "finance");
    assert.equal(gaming.vertical, "gaming");
  });

  it("applies lower RPM for FR vs US", () => {
    const us = scoreCashNiche({
      medViews: 20000, avgSubs: 50000, avgVPD: 800, count: 4,
      titles: ["investing for beginners"], region: "US",
    });
    const fr = scoreCashNiche({
      medViews: 20000, avgSubs: 50000, avgVPD: 800, count: 4,
      titles: ["investing for beginners"], region: "FR",
    });
    assert.ok(fr.rpmMax < us.rpmMax);
  });
});

describe("countryMultiplier", () => {
  it("US is baseline", () => {
    assert.equal(countryMultiplier("US"), 1);
  });
  it("FR is discounted", () => {
    assert.ok(countryMultiplier("FR") < 1);
  });
});

describe("estimateAdsense", () => {
  it("scales with views", () => {
    const a = estimateAdsense(100_000, 2, 4);
    assert.equal(a.min, 200);
    assert.equal(a.max, 400);
    assert.equal(a.mid, 300);
  });
});

describe("scoreChannelMoney", () => {
  it("marks YPP likely for large active channels", () => {
    const channel = {
      snippet: { title: "Finance Daily", country: "US", description: "investing tips" },
      statistics: { subscriberCount: "12000", viewCount: "2000000", videoCount: "200" },
    };
    const recent = Array.from({ length: 10 }, (_, i) => ({
      title: "How to invest " + i,
      views: 15000,
      duration: 600,
      publishedAt: new Date(Date.now() - i * 2 * 86400000).toISOString(),
    }));
    const s = scoreChannelMoney(channel, recent);
    assert.equal(s.vertical, "finance");
    assert.equal(s.yppLikely, true);
    assert.ok(s.monetMax > 0);
    assert.ok(s.cashScore > 0);
  });
});
