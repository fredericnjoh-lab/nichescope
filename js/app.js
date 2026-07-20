/** NicheScope Studio — entry point */

import {
  $, $$,
} from "./utils.js";
import {
  loadKey, saveKey, clearCache, resetQuota, updateQuotaUI, getKey,
} from "./api.js";
import { THEME_KEY } from "./constants.js";
import {
  loadLang, setLang, getLang, applyI18n, t,
} from "./i18n.js";
import {
  applyTheme, toggleTheme, switchTab, showOnboarding, wireOnboarding,
  flashSaved, renderHistory, addHistory,
} from "./ui.js";
import { initStudio, onStudio, renderPipeline } from "./features/studio.js";
import { onNiche } from "./features/niche.js";
import { onTrending } from "./features/trending.js";
import { onChannel } from "./features/channel.js";
import { onKeyword } from "./features/keyword.js";
import { onOutliers } from "./features/outliers.js";
import { getFavorites } from "./favorites.js";

function replaySearch(tab, query) {
  switchTab(tab);
  if (tab === "studio") {
    $("#studio-query").value = query;
    onStudio({ preventDefault() {} });
  }
  if (tab === "niche") { $("#niche-query").value = query; $("#form-niche").requestSubmit(); }
  if (tab === "trending") {
    // history may include metadata after ·
    const q = query.split(" · ")[0];
    $("#trending-query").value = q === "(all)" ? "" : q;
    $("#form-trending").requestSubmit();
  }
  if (tab === "channel") { $("#channel-input").value = query; $("#form-channel").requestSubmit(); }
  if (tab === "keyword") { $("#keyword-query").value = query; $("#form-keyword").requestSubmit(); }
  if (tab === "outliers") {
    const q = query.split(" · ")[0];
    $("#outliers-input").value = q;
    $("#form-outliers").requestSubmit();
  }
}

function wireTabs() {
  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const tabs = $$(".tab");
        const i = tabs.indexOf(tab);
        const next = e.key === "ArrowRight" ? tabs[(i + 1) % tabs.length] : tabs[(i - 1 + tabs.length) % tabs.length];
        next.focus();
        switchTab(next.dataset.tab);
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadLang();
  applyI18n();
  loadKey();
  applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  updateQuotaUI();
  wireTabs();
  wireOnboarding();
  initStudio();
  renderPipeline();

  $("#saveKey")?.addEventListener("click", () => {
    if (saveKey()) flashSaved();
  });
  $("#apiKey")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && saveKey()) flashSaved();
  });

  $("#themeBtn")?.addEventListener("click", toggleTheme);
  $("#langBtn")?.addEventListener("click", () => {
    setLang(getLang() === "fr" ? "en" : "fr");
    applyI18n();
    initStudio();
    renderPipeline();
  });

  $("#historyBtn")?.addEventListener("click", () => {
    renderHistory(replaySearch);
    $("#history-pop")?.classList.toggle("show");
  });
  $("#favBtn")?.addEventListener("click", () => {
    switchTab("studio");
    renderPipeline();
    $("#studio-pipeline")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  $("#closeHistory")?.addEventListener("click", () => $("#history-pop")?.classList.remove("show"));
  document.addEventListener("click", (e) => {
    const pop = $("#history-pop");
    if (!pop?.classList.contains("show")) return;
    if (e.target.closest("#history-pop") || e.target.closest("#historyBtn")) return;
    pop.classList.remove("show");
  });

  $("#clear-cache")?.addEventListener("click", (e) => {
    e.preventDefault();
    clearCache();
    alert(t("alert_cache"));
  });
  $("#reset-quota")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm(t("confirm_quota"))) resetQuota();
  });

  $("#form-niche")?.addEventListener("submit", onNiche);
  $("#form-trending")?.addEventListener("submit", onTrending);
  $("#form-channel")?.addEventListener("submit", onChannel);
  $("#form-keyword")?.addEventListener("submit", onKeyword);
  $("#form-outliers")?.addEventListener("submit", onOutliers);

  // Badge fav count
  const n = getFavorites().length;
  const badge = $("#fav-count");
  if (badge) {
    badge.textContent = n ? String(n) : "";
    badge.hidden = !n;
  }

  if (!getKey()) {
    setTimeout(() => showOnboarding(false), 400);
  }

  void addHistory;
});
