/** YouTube Data API client — cache TTLs per endpoint, quota, batching */

import { $, hydrateVideos } from "./utils.js";
import { t } from "./i18n.js";
import {
  CACHE_PREFIX, KEY_STORAGE, QUOTA_KEY, QUOTA_DAILY_LIMIT,
  HISTORY_KEY, THEME_KEY, LANG_KEY, FAV_KEY, ONBOARD_KEY, BRAND_KEY, TOPICS_KEY,
} from "./constants.js";

export {
  KEY_STORAGE, QUOTA_KEY, HISTORY_KEY, THEME_KEY, LANG_KEY, FAV_KEY, ONBOARD_KEY, BRAND_KEY, TOPICS_KEY, QUOTA_DAILY_LIMIT,
};

const API_BASE = "https://www.googleapis.com/youtube/v3";
const QUOTA = { search: 100, videos: 1, channels: 1, playlistItems: 1 };

/** Longer TTL for stable resources = fewer quota burns */
const TTL = {
  search: 45 * 60 * 1000,
  videos: 2 * 60 * 60 * 1000,
  channels: 6 * 60 * 60 * 1000,
  playlistItems: 2 * 60 * 60 * 1000,
  default: 60 * 60 * 1000,
};

export function getKey() {
  return ($("#apiKey")?.value || "").trim() || localStorage.getItem(KEY_STORAGE) || "";
}

export function saveKey() {
  const k = ($("#apiKey")?.value || "").trim();
  if (!k) {
    alert(t("alert_paste_key"));
    return false;
  }
  localStorage.setItem(KEY_STORAGE, k);
  return true;
}

export function loadKey() {
  const stored = localStorage.getItem(KEY_STORAGE);
  if (stored && $("#apiKey")) $("#apiKey").value = stored;
}

function cacheGet(key, ttl) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { t: ts, v } = JSON.parse(raw);
    if (Date.now() - ts > ttl) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

function cacheSet(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    clearCache();
  }
}

export function clearCache() {
  const keep = new Set([KEY_STORAGE, QUOTA_KEY, HISTORY_KEY, THEME_KEY, LANG_KEY, FAV_KEY, ONBOARD_KEY, BRAND_KEY, TOPICS_KEY]);
  Object.keys(localStorage)
    .filter(k => k.startsWith(CACHE_PREFIX) && !keep.has(k))
    .forEach(k => localStorage.removeItem(k));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getQuotaState() {
  try {
    const stored = JSON.parse(localStorage.getItem(QUOTA_KEY) || "{}");
    if (stored.date !== todayKey()) return { date: todayKey(), units: 0 };
    return stored;
  } catch {
    return { date: todayKey(), units: 0 };
  }
}

function addQuota(endpoint) {
  const s = getQuotaState();
  s.units += QUOTA[endpoint] || 1;
  localStorage.setItem(QUOTA_KEY, JSON.stringify(s));
  updateQuotaUI();
}

export function updateQuotaUI() {
  const s = getQuotaState();
  const el = $("#quota-count");
  if (el) el.textContent = s.units.toLocaleString();
  const info = $("#quota-info");
  if (!info) return;
  info.classList.remove("warn", "bad");
  if (s.units >= 9500) info.classList.add("bad");
  else if (s.units >= 8000) info.classList.add("warn");
}

export function resetQuota() {
  localStorage.removeItem(QUOTA_KEY);
  updateQuotaUI();
}

export function friendly(err) {
  const m = (err?.message || String(err)).toLowerCase();
  if (m.includes("api key not valid") || (m.includes("invalid") && m.includes("key")))
    return t("err_invalid_key");
  if (m.includes("quota") || m.includes("daily limit") || m.includes("rate limit"))
    return t("err_quota");
  if (m.includes("referer") || (m.includes("ip") && m.includes("not allowed")) || m.includes("requests from this"))
    return t("err_referer");
  if (m.includes("disabled") && m.includes("api"))
    return t("err_disabled");
  if (m.includes("not found") || m.includes("notfound"))
    return t("err_not_found");
  if (m.includes("add your youtube") || m.includes("api key"))
    return t("err_no_key");
  return err?.message || String(err);
}

export async function yt(endpoint, params) {
  const key = getKey();
  if (!key) throw new Error(t("err_no_key"));

  const cacheKey = endpoint + ":" + JSON.stringify(params);
  const ttl = TTL[endpoint] || TTL.default;
  const cached = cacheGet(cacheKey, ttl);
  if (cached) return cached;

  const url = new URL(`${API_BASE}/${endpoint}`);
  Object.entries({ ...params, key }).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }

  addQuota(endpoint);
  cacheSet(cacheKey, data);
  return data;
}

/** Fetch videos in chunks of 50 (API max) — one quota unit per chunk */
export async function ytVideos(ids, part = "snippet,statistics,contentDetails") {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return { items: [] };
  const chunks = [];
  for (let i = 0; i < unique.length; i += 50) chunks.push(unique.slice(i, i + 50));
  const results = await Promise.all(
    chunks.map(chunk => yt("videos", { part, id: chunk.join(",") }))
  );
  return { items: results.flatMap(r => r.items || []) };
}

/** Fetch channels in chunks of 50 */
export async function ytChannels(ids, part = "statistics,snippet") {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return { items: [] };
  const chunks = [];
  for (let i = 0; i < unique.length; i += 50) chunks.push(unique.slice(i, i + 50));
  const results = await Promise.all(
    chunks.map(chunk => yt("channels", { part, id: chunk.join(",") }))
  );
  return { items: results.flatMap(r => r.items || []) };
}

export async function resolveChannel(raw) {
  let id = null;
  let handle = null;
  if (/^UC[\w-]{20,}$/.test(raw)) {
    id = raw;
  } else if (raw.includes("youtube.com") || raw.includes("youtu.be")) {
    try {
      const u = new URL(raw.startsWith("http") ? raw : "https://" + raw);
      const parts = u.pathname.split("/").filter(Boolean);
      const channelIdx = parts.indexOf("channel");
      if (channelIdx >= 0 && parts[channelIdx + 1]) id = parts[channelIdx + 1];
      else {
        const handlePart = parts.find(p => p.startsWith("@"));
        if (handlePart) handle = handlePart;
        else if (parts[0] === "user" || parts[0] === "c") handle = parts[1];
      }
    } catch { /* ignore */ }
  } else if (raw.startsWith("@")) {
    handle = raw;
  } else {
    handle = "@" + raw;
  }

  let resp;
  if (id) {
    resp = await yt("channels", { part: "snippet,statistics,contentDetails,brandingSettings", id });
  } else if (handle) {
    resp = await yt("channels", { part: "snippet,statistics,contentDetails,brandingSettings", forHandle: handle });
  }
  return resp?.items?.[0] || null;
}

export async function fetchRecentVideos(channel, count = 50) {
  const playlist = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!playlist) return [];
  const pl = await yt("playlistItems", { part: "contentDetails", playlistId: playlist, maxResults: count });
  const ids = (pl.items || []).map(i => i.contentDetails.videoId).filter(Boolean);
  if (!ids.length) return [];
  const vd = await ytVideos(ids);
  return hydrateVideos(vd.items);
}
