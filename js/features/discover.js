/** Shared niche discovery pipeline used by Niche + Studio tabs */

import { yt, ytVideos, ytChannels } from "../api.js";
import { daysSince, median, hydrateVideos } from "../utils.js";
import { tokenize, extractTopTerms } from "../clustering.js";
import { scoreCashNiche } from "../money.js";

export async function discoverNiches(query, region = "", langHint = "fr") {
  const relevanceLanguage = langHint === "en" ? "en" : "fr";
  const search = await yt("search", {
    part: "snippet",
    q: query,
    type: "video",
    maxResults: 50,
    regionCode: region || undefined,
    relevanceLanguage,
    order: "relevance",
  });

  if (!search.items?.length) return { clusters: [], videos: [], channelMap: new Map() };

  const videoIds = search.items.map(i => i.id.videoId).filter(Boolean);
  const channelIds = [...new Set(search.items.map(i => i.snippet.channelId))];

  const [videoData, channelData] = await Promise.all([
    ytVideos(videoIds),
    ytChannels(channelIds),
  ]);

  const channelMap = new Map((channelData.items || []).map(c => [c.id, c]));
  const channelTitleSet = new Set((channelData.items || []).map(c => c.snippet.title.toLowerCase()));

  const videos = hydrateVideos(videoData.items).map(v => ({
    ...v,
    channelSubs: parseInt(channelMap.get(v.channelId)?.statistics?.subscriberCount || 0, 10),
  }));

  const queryStem = tokenize(query).join(" ");
  const titleTexts = videos.map(v => v.title + " " + (v.tags || []).slice(0, 8).join(" "));
  const weights = videos.map(v => v.views / daysSince(v.publishedAt));

  const topTerms = extractTopTerms(titleTexts, 30, weights)
    .filter(([term]) => !queryStem.split(" ").every(q => term.includes(q)))
    .filter(([term]) => !channelTitleSet.has(term));

  const clusters = topTerms.map(([term]) => {
    const stems = term.split(" ");
    const matched = videos.filter(v => {
      const tt = tokenize(v.title + " " + (v.tags || []).join(" ")).join(" ");
      return stems.every(s => tt.includes(s));
    });
    if (matched.length < 2) return null;

    const avgViews = matched.reduce((s, v) => s + v.views, 0) / matched.length;
    const avgSubs = matched.reduce((s, v) => s + v.channelSubs, 0) / matched.length;
    const medViews = median(matched.map(v => v.views));
    const avgVPD = matched.reduce((s, v) => s + v.views / daysSince(v.publishedAt), 0) / matched.length;
    const opportunity = avgSubs > 0 ? avgViews / avgSubs : 0;

    const channelStats = new Map();
    matched.forEach(v => {
      if (!channelStats.has(v.channelId)) {
        const ch = channelMap.get(v.channelId);
        channelStats.set(v.channelId, {
          id: v.channelId,
          title: v.channelTitle,
          handle: ch?.snippet?.customUrl || "",
          subs: v.channelSubs,
          count: 0,
          views: 0,
        });
      }
      const st = channelStats.get(v.channelId);
      st.count++;
      st.views += v.views;
    });
    const topChannels = [...channelStats.values()]
      .sort((a, b) => b.count - a.count || b.subs - a.subs)
      .slice(0, 4);

    // Money channels: mid-size with high views-per-sub in this cluster
    const moneyChannels = [...channelStats.values()]
      .map(ch => ({
        ...ch,
        vps: ch.subs > 0 ? (ch.views / ch.count) / ch.subs : 0,
      }))
      .filter(ch => ch.subs >= 1000 && ch.subs <= 500_000)
      .sort((a, b) => b.vps - a.vps)
      .slice(0, 3);

    const money = scoreCashNiche({
      medViews, avgSubs, avgVPD, count: matched.length,
      titles: matched.map(v => v.title),
      tags: matched.flatMap(v => v.tags || []),
      region,
    });

    return {
      term,
      count: matched.length,
      avgViews, medViews, avgSubs, avgVPD, opportunity,
      topChannels, moneyChannels,
      sampleTitles: matched.slice(0, 2).map(v => v.title),
      ...money,
    };
  }).filter(Boolean);

  // Legacy opportunity score (kept for Niche tab sort)
  if (clusters.length) {
    const maxOpp = Math.max(...clusters.map(c => c.opportunity), 0.001);
    const maxVPD = Math.max(...clusters.map(c => c.avgVPD), 1);
    const maxCnt = Math.max(...clusters.map(c => c.count), 1);
    clusters.forEach(c => {
      c.oppScore = Math.round(
        (c.opportunity / maxOpp) * 50 +
        (c.avgVPD / maxVPD) * 30 +
        (c.count / maxCnt) * 20
      );
      // Blend: cash-first for Studio, but keep unified score
      c.score = Math.round(c.cashScore * 0.65 + c.oppScore * 0.35);
    });
  }

  return { clusters, videos, channelMap };
}
