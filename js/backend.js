/**
 * Supabase client for P3 rankings.
 * Config stored in localStorage (same pattern as YouTube API key).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getKey } from "./api.js";

const SB_URL_KEY = "nschost:supabase_url";
const SB_ANON_KEY = "nschost:supabase_anon";

let client = null;
let sessionPromise = null;

export function getSupabaseConfig() {
  return {
    url: (localStorage.getItem(SB_URL_KEY) || "").trim(),
    anonKey: (localStorage.getItem(SB_ANON_KEY) || "").trim(),
  };
}

export function saveSupabaseConfig({ url, anonKey }) {
  const u = (url || "").trim().replace(/\/$/, "");
  const k = (anonKey || "").trim();
  if (u) localStorage.setItem(SB_URL_KEY, u);
  else localStorage.removeItem(SB_URL_KEY);
  if (k) localStorage.setItem(SB_ANON_KEY, k);
  else localStorage.removeItem(SB_ANON_KEY);
  client = null;
  sessionPromise = null;
  return isBackendConfigured();
}

export function isBackendConfigured() {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey);
}

export function getSupabase() {
  if (!isBackendConfigured()) return null;
  if (client) return client;
  const { url, anonKey } = getSupabaseConfig();
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "nschost:supabase_auth",
    },
  });
  return client;
}

/** Anonymous auth (enable in Supabase Dashboard → Auth → Anonymous) */
export async function ensureBackendSession() {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (session) return session;
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      return data.session;
    })().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

export async function listTrackedKeywords() {
  const sb = getSupabase();
  await ensureBackendSession();
  const { data, error } = await sb
    .from("tracked_keywords")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addTrackedKeyword({ keyword, region = "", lang = "fr" }) {
  const sb = getSupabase();
  const session = await ensureBackendSession();
  const { data, error } = await sb
    .from("tracked_keywords")
    .upsert(
      {
        user_id: session.user.id,
        keyword: keyword.trim(),
        region: region || "",
        lang: lang || "fr",
        active: true,
      },
      { onConflict: "user_id,keyword,region" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function removeTrackedKeyword(id) {
  const sb = getSupabase();
  await ensureBackendSession();
  const { error } = await sb.from("tracked_keywords").delete().eq("id", id);
  if (error) throw error;
}

export async function listSnapshots(trackedKeywordId, limit = 30) {
  const sb = getSupabase();
  await ensureBackendSession();
  const { data, error } = await sb
    .from("ranking_snapshots")
    .select("*")
    .eq("tracked_keyword_id", trackedKeywordId)
    .order("captured_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/** Invoke Edge Function scan-keyword */
export async function scanTrackedKeyword(trackedKeywordId) {
  const sb = getSupabase();
  const session = await ensureBackendSession();
  const ytKey = getKey();
  if (!ytKey) throw new Error("YouTube API key required to scan");

  const { data, error } = await sb.functions.invoke("scan-keyword", {
    body: { trackedKeywordId },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "x-youtube-key": ytKey,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * One-shot: add keyword to Rankings + first scan.
 * Used from Keywords / Optimize tabs.
 */
export async function trackKeywordAndScan(keyword, { region = "", lang = "fr" } = {}) {
  if (!isBackendConfigured()) {
    const err = new Error("backend_not_configured");
    err.code = "backend_not_configured";
    throw err;
  }
  const row = await addTrackedKeyword({ keyword, region, lang });
  const scan = await scanTrackedKeyword(row.id);
  return { row, scan };
}
