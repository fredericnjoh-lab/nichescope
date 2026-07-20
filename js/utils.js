/** Shared helpers — formatting, DOM, duration, stats */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function fmtNum(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  n = Number(n);
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return Math.round(n).toLocaleString();
}

export function fmtMoney(n, currency = "USD") {
  if (n === undefined || n === null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  const opts = { style: "currency", currency, maximumFractionDigits: abs >= 100 ? 0 : 0 };
  try {
    return new Intl.NumberFormat(undefined, opts).format(Math.round(n));
  } catch {
    return "$" + fmtNum(n);
  }
}

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function fmtRelTime(t) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

export function daysSince(iso) {
  if (!iso) return 1;
  return Math.max(1, (Date.now() - new Date(iso).getTime()) / 86400000);
}

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

export function parseISODuration(d) {
  if (!d) return 0;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

export function fmtDuration(seconds) {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function filterByFormat(videos, format) {
  if (format === "long") return videos.filter(v => v.duration >= 60);
  if (format === "shorts") return videos.filter(v => v.duration > 0 && v.duration < 60);
  return videos;
}

export function hydrateVideos(items) {
  return (items || []).map(v => ({
    id: v.id,
    title: v.snippet.title,
    channelTitle: v.snippet.channelTitle,
    channelId: v.snippet.channelId,
    publishedAt: v.snippet.publishedAt,
    tags: v.snippet.tags || [],
    thumb: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
    views: parseInt(v.statistics?.viewCount || 0, 10),
    likes: parseInt(v.statistics?.likeCount || 0, 10),
    comments: parseInt(v.statistics?.commentCount || 0, 10),
    duration: parseISODuration(v.contentDetails?.duration),
  }));
}

export function scoreClass(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "med";
  return "low";
}

export function toCSV(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return (/[",\n]/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
}

export function downloadCSV(rows, filename) {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvButton(rows, filename, label = "⬇ CSV") {
  const id = "csv-" + Math.random().toString(36).slice(2, 8);
  setTimeout(() => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", () => downloadCSV(rows, filename));
  }, 0);
  return `<button type="button" class="btn-csv" id="${id}" title="${label}">${label}</button>`;
}

export function jsonButton(obj, filename, label = "⬇ JSON") {
  const id = "json-" + Math.random().toString(36).slice(2, 8);
  setTimeout(() => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", () => downloadJSON(obj, filename));
  }, 0);
  return `<button type="button" class="btn-csv" id="${id}" title="${label}">${label}</button>`;
}
