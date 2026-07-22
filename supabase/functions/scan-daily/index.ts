/**
 * Cron Edge Function: rescan all active tracked keywords (batch).
 *
 * Secrets required:
 *   YOUTUBE_API_KEY
 *   CRON_SECRET          — shared secret header x-cron-secret
 *   SUPABASE_SERVICE_ROLE_KEY (auto-injected on hosted Supabase)
 *
 * Invoke:
 *   POST /functions/v1/scan-daily
 *   Header: x-cron-secret: <CRON_SECRET>
 *   Optional body: { limit?: number }  default 40
 *
 * Schedule (Dashboard → Edge Functions → scan-daily → Cron)
 * or pg_cron + net.http_post — see supabase/README.md
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fetchKeywordMetrics } from "../_shared/youtube-rank.ts";

const MAX_DEFAULT = 40;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors() });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "POST or GET" }, 405);
  }

  try {
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const provided =
      req.headers.get("x-cron-secret") ||
      new URL(req.url).searchParams.get("secret") ||
      "";
    if (!cronSecret || provided !== cronSecret) {
      return json({ error: "Unauthorized (bad cron secret)" }, 401);
    }

    const youtubeKey = Deno.env.get("YOUTUBE_API_KEY") || "";
    if (!youtubeKey) {
      return json({ error: "Missing secret YOUTUBE_API_KEY" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    let limit = MAX_DEFAULT;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.limit) limit = Math.min(100, Math.max(1, Number(body.limit)));
    }

    const { data: keywords, error } = await admin
      .from("tracked_keywords")
      .select("id,user_id,keyword,region,lang")
      .eq("active", true)
      .order("updated_at", { ascending: true })
      .limit(limit);

    if (error) return json({ error: error.message }, 500);
    if (!keywords?.length) {
      return json({ ok: true, scanned: 0, message: "No active keywords" });
    }

    const results: Array<{ id: string; keyword: string; ok: boolean; error?: string; overall?: number }> = [];

    for (const kw of keywords) {
      try {
        const metrics = await fetchKeywordMetrics(kw, youtubeKey);
        const { error: insErr } = await admin.from("ranking_snapshots").insert({
          tracked_keyword_id: kw.id,
          user_id: kw.user_id,
          overall_score: metrics.scores.overall,
          volume_score: metrics.scores.volumeScore,
          competition_score: metrics.scores.competitionScore,
          opportunity_score: metrics.scores.opportunityScore,
          total_results: metrics.totalResults,
          avg_top_views: metrics.avgTopViews,
          avg_top_subs: metrics.avgTopSubs,
          small_channels: metrics.smallChannels,
          top_video_ids: metrics.topVideoIds,
          meta: { source: "edge/scan-daily" },
        });
        if (insErr) throw new Error(insErr.message);

        await admin
          .from("tracked_keywords")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", kw.id);

        results.push({ id: kw.id, keyword: kw.keyword, ok: true, overall: metrics.scores.overall });
        // gentle pacing for YouTube quota
        await sleep(250);
      } catch (err) {
        results.push({
          id: kw.id,
          keyword: kw.keyword,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const ok = results.filter((r) => r.ok).length;
    return json({
      ok: true,
      scanned: ok,
      failed: results.length - ok,
      results,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(), "Content-Type": "application/json" },
  });
}
