/**
 * Edge Function: scan a tracked keyword via YouTube Data API and write a ranking snapshot.
 *
 * Request JSON: { trackedKeywordId: string }
 * Header: Authorization: Bearer <user jwt>
 * Header (required): x-youtube-key: <user's YT key>
 *
 * Never falls back to the server YOUTUBE_API_KEY — that secret is for scan-daily only.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const YT = "https://www.googleapis.com/youtube/v3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors() });
  }
  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const youtubeKey = (req.headers.get("x-youtube-key") || "").trim();
    if (!youtubeKey) {
      return json({ error: "Missing YouTube API key (header x-youtube-key required)" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const trackedKeywordId = body.trackedKeywordId as string | undefined;
    if (!trackedKeywordId) {
      return json({ error: "trackedKeywordId required" }, 400);
    }

    const { data: tracked, error: tErr } = await userClient
      .from("tracked_keywords")
      .select("*")
      .eq("id", trackedKeywordId)
      .eq("user_id", userId)
      .single();

    if (tErr || !tracked) {
      return json({ error: "Tracked keyword not found" }, 404);
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentScans, error: rateErr } = await userClient
      .from("ranking_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("captured_at", hourAgo);
    if (rateErr) {
      return json({ error: rateErr.message }, 500);
    }
    if ((recentScans ?? 0) >= 20) {
      return json({ error: "Too many scans; try again later" }, 429);
    }

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
      return json({ error: search.error?.message || "YouTube search failed" }, 502);
    }

    const items = search.items || [];
    const totalResults = search.pageInfo?.totalResults || 0;
    const videoIds = items.map((i: { id?: { videoId?: string } }) => i.id?.videoId).filter(Boolean);
    const channelIds = [...new Set(items.map((i: { snippet?: { channelId?: string } }) => i.snippet?.channelId).filter(Boolean))];

    let avgTopViews = 0;
    let avgTopSubs = 0;
    let smallChannels = 0;
    const topVideoIds: string[] = videoIds;

    if (videoIds.length) {
      const vUrl = new URL(`${YT}/videos`);
      vUrl.searchParams.set("part", "statistics");
      vUrl.searchParams.set("id", videoIds.join(","));
      vUrl.searchParams.set("key", youtubeKey);
      const vRes = await fetch(vUrl);
      const vData = await vRes.json();
      const views = (vData.items || []).map((v: { statistics?: { viewCount?: string } }) =>
        parseInt(v.statistics?.viewCount || "0", 10)
      );
      avgTopViews = views.length ? views.reduce((a: number, b: number) => a + b, 0) / views.length : 0;
    }

    if (channelIds.length) {
      const cUrl = new URL(`${YT}/channels`);
      cUrl.searchParams.set("part", "statistics");
      cUrl.searchParams.set("id", channelIds.join(","));
      cUrl.searchParams.set("key", youtubeKey);
      const cRes = await fetch(cUrl);
      const cData = await cRes.json();
      const subs = (cData.items || []).map((c: { statistics?: { subscriberCount?: string } }) =>
        parseInt(c.statistics?.subscriberCount || "0", 10)
      );
      avgTopSubs = subs.length ? subs.reduce((a: number, b: number) => a + b, 0) / subs.length : 0;
      smallChannels = subs.filter((s: number) => s < 100_000).length;
    }

    const scores = scoreKeywordOverall({
      totalResults,
      avgTopSubs,
      avgTopViews,
      smallChannels,
    });

    const { data: snap, error: sErr } = await userClient
      .from("ranking_snapshots")
      .insert({
        tracked_keyword_id: trackedKeywordId,
        user_id: userId,
        overall_score: scores.overall,
        volume_score: scores.volumeScore,
        competition_score: scores.competitionScore,
        opportunity_score: scores.opportunityScore,
        total_results: totalResults,
        avg_top_views: Math.round(avgTopViews),
        avg_top_subs: Math.round(avgTopSubs),
        small_channels: smallChannels,
        top_video_ids: topVideoIds,
        meta: { source: "edge/scan-keyword" },
      })
      .select("*")
      .single();

    if (sErr) {
      return json({ error: sErr.message }, 500);
    }

    await userClient
      .from("tracked_keywords")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", trackedKeywordId);

    return json({ ok: true, snapshot: snap, scores });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function scoreKeywordOverall({
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

  return {
    overall: clamp(overall),
    volumeScore: clamp(volumeScore),
    competitionScore: clamp(competitionScore),
    opportunityScore: clamp(opportunityScore),
  };
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-youtube-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(), "Content-Type": "application/json" },
  });
}
