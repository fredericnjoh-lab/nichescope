/** Shared UI: loading, history, theme, onboarding */

import { $, $$, escapeHtml, fmtRelTime } from "./utils.js";
import { t, applyI18n } from "./i18n.js";
import { friendly, HISTORY_KEY, THEME_KEY, ONBOARD_KEY, KEY_STORAGE, saveKey, loadKey } from "./api.js";

export function setLoading(target) {
  $(target).innerHTML = `<div class="loading" role="status">${escapeHtml(t("loading"))}</div>`;
}

export function setError(target, err) {
  console.error(err);
  $(target).innerHTML = `<div class="error" role="alert">${escapeHtml(friendly(err))}</div>`;
}

export function setEmpty(target, msg) {
  $(target).innerHTML = `<div class="empty">${escapeHtml(msg)}</div>`;
}

export function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function saveHistory(arr) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
}

export function addHistory(tab, query) {
  if (!query || !query.trim()) return;
  let arr = getHistory();
  arr = arr.filter(h => !(h.tab === tab && h.query === query));
  arr.unshift({ tab, query, t: Date.now(), starred: false });
  const starred = arr.filter(h => h.starred);
  const unstarred = arr.filter(h => !h.starred).slice(0, 30);
  saveHistory([...starred, ...unstarred]);
}

function toggleStar(ts, query) {
  const arr = getHistory();
  const idx = arr.findIndex(h => h.t === ts && h.query === query);
  if (idx >= 0) {
    arr[idx].starred = !arr[idx].starred;
    saveHistory(arr);
  }
  renderHistory();
}

export function renderHistory(replaySearch) {
  const arr = getHistory();
  if (!arr.length) {
    $("#history-list").innerHTML = `<div class="history-empty">${escapeHtml(t("history_empty"))}</div>`;
    return;
  }
  const tabLabels = {
    studio: t("tab_studio"),
    niche: t("tab_niche"),
    trending: t("tab_trending"),
    channel: t("tab_channel"),
    keyword: t("tab_keyword"),
    optimize: t("tab_optimize"),
    outliers: t("tab_outliers"),
  };
  $("#history-list").innerHTML = arr.map(h => `
    <div class="history-item" data-tab="${h.tab}" data-query="${escapeHtml(h.query)}" data-t="${h.t}" role="button" tabindex="0">
      <button type="button" class="star ${h.starred ? "active" : ""}" title="★" data-action="star" aria-label="star">${h.starred ? "★" : "☆"}</button>
      <div class="history-meta">
        <div class="history-tab">${tabLabels[h.tab] || h.tab}</div>
        <div class="history-q">${escapeHtml(h.query)}</div>
      </div>
      <div class="history-time">${fmtRelTime(h.t)}</div>
    </div>
  `).join("");

  $$("#history-list .history-item").forEach(el => {
    const run = (e) => {
      if (e.target.dataset?.action === "star") {
        toggleStar(parseInt(el.dataset.t, 10), el.dataset.query);
        e.stopPropagation();
        return;
      }
      replaySearch?.(el.dataset.tab, el.dataset.query);
      $("#history-pop")?.classList.remove("show");
    };
    el.addEventListener("click", run);
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(e); }
    });
  });
}

export function applyTheme(theme) {
  if (theme === "light") {
    document.body.classList.add("light");
    if ($("#themeBtn")) {
      $("#themeBtn").textContent = "☀";
      $("#themeBtn").title = t("theme");
    }
  } else {
    document.body.classList.remove("light");
    if ($("#themeBtn")) {
      $("#themeBtn").textContent = "☾";
      $("#themeBtn").title = t("theme");
    }
  }
}

export function toggleTheme() {
  const next = document.body.classList.contains("light") ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

export function switchTab(tabId) {
  $$(".tab").forEach(tEl => {
    const on = tEl.dataset.tab === tabId;
    tEl.classList.toggle("active", on);
    tEl.setAttribute("aria-selected", on ? "true" : "false");
  });
  $$(".panel").forEach(p => {
    p.classList.toggle("active", p.id === "panel-" + tabId);
  });
}

export function showOnboarding(force = false) {
  const done = localStorage.getItem(ONBOARD_KEY);
  const hasKey = !!localStorage.getItem(KEY_STORAGE);
  if (!force && done && hasKey) return;
  $("#modal-help")?.classList.add("show");
  $("#modal-help")?.setAttribute("aria-hidden", "false");
  $("#closeHelp")?.focus();
}

export function closeOnboarding(markDone = true) {
  $("#modal-help")?.classList.remove("show");
  $("#modal-help")?.setAttribute("aria-hidden", "true");
  if (markDone) localStorage.setItem(ONBOARD_KEY, "1");
}

export function wireOnboarding() {
  $("#helpKey")?.addEventListener("click", () => showOnboarding(true));
  $("#closeHelp")?.addEventListener("click", () => {
    if ($("#apiKey")?.value.trim()) saveKey();
    closeOnboarding(true);
  });
  $("#onboardLater")?.addEventListener("click", () => closeOnboarding(false));
  $("#modal-help")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-help") closeOnboarding(false);
  });
  $("#modal-help")?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOnboarding(false);
  });
}

export function flashSaved() {
  const btn = $("#saveKey");
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = t("saved");
  setTimeout(() => { btn.textContent = t("save"); }, 1200);
}

export { loadKey, applyI18n };
