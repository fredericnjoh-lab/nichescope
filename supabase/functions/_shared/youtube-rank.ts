/** Shared YouTube keyword ranking helpers for Edge Functions */

export const YT = "https://www.googleapis.com/youtube/v3";

export function scoreKeywordOverall({
  totalResults = 0,
  avgTopSubs = 0,
  avgTopViews = 0,
  smallChannels = 0,
}: {
  totalResults?: number;
  avgTopSubs?: number;
  avgTopViews?: number;
  smallChannels?: number;
}) {
  const demandFromViews = Math.min(100, Math.log10(1 + avgTopViews) * 18);
  const demandFromMarket = Math.min(100, Math.log10(1 + totalResults) * 12);
  const volumeScore = Math.round(demandFromViews * 0.65 + demandFromMarket * 0.35);

  let competitionRaw = 50;
  if (avgTopSubs > 5e6) competitionRaw = 95;
  else if (avgTopSubs > 1e6) competitionRaw = 80;
  else if (avgTopSubs > 250000) competitionRaw = 65;
  else if (avgTopSubs > 50000) competitionRaw = 45;
  else if (avgTopSubs > 10000) competitionRaw = 30;
  else competitionRaw = 15;

  competitionRaw = Math.max(5, competitionRaw - smallChannels * 4);
  const competitionScore = Math.round(competitionRaw);
  const opportunityScore = 100 - competitionScore;
  const overall = Math.round(volumeScore * 0.45 + opportunityScore * 0.55);
  const clamp = (n: number) => Math.max(0, Math.min(100, n));

  return {
    overall: clamp(overall),
    volumeScore: clamp(volumeScore),
    competitionScore: clamp(competitionScore),
    opportunityScore: clamp(opportunityScore),
  };
}

export type TrackedKeyword = {
  id: string;
  user_id: string;
  keyword: string;
  region?: string;
  lang?: string;
};

export async function fetchKeywordMetrics(
  tracked: TrackedKeyword,
  youtubeKey: string,
) {
  const lang = tracked.lang === "en" ? "en" : "fr";
  const region = tracked.region || undefined;

  const searchUrl = new URL(`${YT}/search`);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", tracked.keyword);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "10");
  searchUrl.searchParams.set("order", "relevance");
  searchUrl.searchParams.set("relevanceLanguage", lang);
  searchUrl.searchParams.set("key", youtubeKey);
  if (region) searchUrl.searchParams.set("regionCode", region);

  const searchRes = await fetch(searchUrl);
  const search = await searchRes.json();
  if (!searchRes.ok) {
    throw new Error(search.error?.message || "YouTube search failed");
  }

  const items = search.items || [];
  const totalResults = search.pageInfo?.totalResults || 0;
  const videoIds = items
    .map((i: { id?: { videoId?: string } }) => i.id?.videoId)
    .filter(Boolean) as string[];
  const channelIds = [
    ...new Set(
      items
        .map((i: { snippet?: { channelId?: string } }) => i.snippet?.channelId)
        .filter(Boolean),
    ),
  ] as string[];

  let avgTopViews = 0;
  let avgTopSubs = 0;
  let smallChannels = 0;

  if (videoIds.length) {
    const vUrl = new URL(`${YT}/videos`);
    vUrl.searchParams.set("part", "statistics");
    vUrl.searchParams.set("id", videoIds.join(","));
    vUrl.searchParams.set("key", youtubeKey);
    const vRes = await fetch(vUrl);
    const vData = await vRes.json();
    const views = (vData.items || []).map(
      (v: { statistics?: { viewCount?: string } }) =>
        parseInt(v.statistics?.viewCount || "0", 10),
    );
    avgTopViews = views.length
      ? views.reduce((a: number, b: number) => a + b, 0) / views.length
      : 0;
  }

  if (channelIds.length) {
    const cUrl = new URL(`${YT}/channels`);
    cUrl.searchParams.set("part", "statistics");
    cUrl.searchParams.set("id", channelIds.join(","));
    cUrl.searchParams.set("key", youtubeKey);
    const cRes = await fetch(cUrl);
    const cData = await cRes.json();
    const subs = (cData.items || []).map(
      (c: { statistics?: { subscriberCount?: string } }) =>
        parseInt(c.statistics?.subscriberCount || "0", 10),
    );
    avgTopSubs = subs.length
      ? subs.reduce((a: number, b: number) => a + b, 0) / subs.length
      : 0;
    smallChannels = subs.filter((s: number) => s < 100_000).length;
  }

  const scores = scoreKeywordOverall({
    totalResults,
    avgTopSubs,
    avgTopViews,
    smallChannels,
  });

  return {
    scores,
    totalResults,
    avgTopViews: Math.round(avgTopViews),
    avgTopSubs: Math.round(avgTopSubs),
    smallChannels,
    topVideoIds: videoIds,
  };
}
