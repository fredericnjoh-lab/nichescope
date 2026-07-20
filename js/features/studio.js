/** Cash Studio — competitive monetization workflow */

import { $, $$, escapeHtml, fmtNum, fmtMoney, scoreClass, csvButton, jsonButton } from "../utils.js";
import { t, verticalLabel, getLang } from "../i18n.js";
import { addHistory, setLoading, setError, setEmpty, switchTab } from "../ui.js";
import { discoverNiches } from "./discover.js";
import { getFavorites, toggleFavorite, isFavorite, removeFavorite } from "../favorites.js";
import { STUDIO_PRESETS } from "../money.js";
import { initPlan } from "./plan.js";
import { initAudit } from "./audit.js";
import { setStudioSnapshot } from "../session.js";

let lastClusters = [];
let lastTopic = "";
let lastMoneyChannels = [];

function rememberSnapshot() {
  setStudioSnapshot({
    clusters: lastClusters,
    topic: lastTopic,
    moneyChannels: lastMoneyChannels,
  });
}

function updateFavBadge() {
  const n = getFavorites().length;
  const badge = $("#fav-count");
  if (!badge) return;
  badge.textContent = n ? String(n) : "";
  badge.hidden = !n;
}

function renderPipeline() {
  const box = $("#studio-pipeline");
  updateFavBadge();
  if (!box) return;
  const favs = getFavorites();
  if (!favs.length) {
    box.innerHTML = `<div class="pipeline-empty">${escapeHtml(t("studio_empty_pipeline"))}</div>`;
    return;
  }
  box.innerHTML = `
    <div class="pipeline-list">
      ${favs.map(f => `
        <div class="pipeline-item" data-type="${f.type}" data-id="${escapeHtml(f.id)}">
          <span class="pipeline-type">${f.type === "channel" ? "▶" : "◆"}</span>
          <div class="pipeline-meta">
            <div class="pipeline-title">${escapeHtml(f.title)}</div>
            <div class="pipeline-sub">${escapeHtml(f.meta?.vertical ? verticalLabel(f.meta.vertical) : f.type)}
              ${f.meta?.cashScore != null ? ` · Cash ${f.meta.cashScore}` : ""}
              ${f.meta?.monthlyMid != null ? ` · ~${fmtMoney(f.meta.monthlyMid)}/mo` : ""}
            </div>
          </div>
          <button type="button" class="btn-icon danger pipeline-rm" data-action="rm" aria-label="${escapeHtml(t("rem_fav"))}">×</button>
        </div>
      `).join("")}
    </div>
    <div class="pipeline-actions">
      ${csvButton(favs.map(f => ({
        type: f.type, id: f.id, title: f.title,
        vertical: f.meta?.vertical || "",
        cash_score: f.meta?.cashScore ?? "",
        est_monthly_mid: f.meta?.monthlyMid != null ? Math.round(f.meta.monthlyMid) : "",
      })), "nichescope-studio-pipeline.csv", t("export_csv"))}
      ${jsonButton({ exportedAt: new Date().toISOString(), pipeline: favs }, "nichescope-studio-brief.json", t("export_json"))}
    </div>
  `;
  $$(".pipeline-rm", box).forEach(btn => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".pipeline-item");
      removeFavorite(item.dataset.type, item.dataset.id);
      renderPipeline();
      if (lastClusters.length) renderStudioResults(lastClusters, lastTopic, lastMoneyChannels);
    });
  });
}

function favBtn(type, id, title, meta) {
  const on = isFavorite(type, id);
  const label = on ? t("rem_fav") : t("add_fav");
  return `<button type="button" class="btn-fav ${on ? "on" : ""}" data-fav-type="${type}" data-fav-id="${escapeHtml(id)}" data-fav-title="${escapeHtml(title)}" data-fav-meta='${escapeHtml(JSON.stringify(meta || {}))}' title="${escapeHtml(label)}" aria-pressed="${on}">${on ? "★" : "☆"}</button>`;
}

function wireFavButtons(root) {
  $$(`${root} .btn-fav`).forEach(btn => {
    btn.addEventListener("click", () => {
      let meta = {};
      try { meta = JSON.parse(btn.dataset.favMeta || "{}"); } catch { /* ignore */ }
      toggleFavorite({
        type: btn.dataset.favType,
        id: btn.dataset.favId,
        title: btn.dataset.favTitle,
        meta,
      });
      renderPipeline();
      if (lastClusters.length) renderStudioResults(lastClusters, lastTopic, lastMoneyChannels);
    });
  });
}

function applyFilters(clusters) {
  const minCash = parseInt($("#studio-min-cash")?.value || "0", 10);
  const affOnly = $("#studio-affiliate")?.checked;
  const sort = $("#studio-sort")?.value || "cash";
  let list = clusters.filter(c => c.cashScore >= minCash);
  if (affOnly) list = list.filter(c => c.affiliate);
  if (sort === "cash") list.sort((a, b) => b.cashScore - a.cashScore);
  else if (sort === "opp") list.sort((a, b) => b.opportunity - a.opportunity);
  else list.sort((a, b) => b.medViews - a.medViews);
  return list;
}

function renderStudioResults(clusters, topic, moneyChannels) {
  lastClusters = clusters;
  lastTopic = topic;
  lastMoneyChannels = moneyChannels;
  rememberSnapshot();
  const list = applyFilters(clusters);

  const csvRows = list.map(c => ({
    sub_niche: c.term,
    cash_score: c.cashScore,
    vertical: c.vertical,
    affiliate: c.affiliate,
    rpm_min: c.rpmMin.toFixed(2),
    rpm_max: c.rpmMax.toFixed(2),
    est_monthly_min: Math.round(c.monthlyMin),
    est_monthly_max: Math.round(c.monthlyMax),
    median_views: Math.round(c.medViews),
    avg_subs: Math.round(c.avgSubs),
    opportunity: c.opportunity.toFixed(3),
    video_count: c.count,
  }));

  const brief = {
    topic,
    generatedAt: new Date().toISOString(),
    niches: list.slice(0, 12),
    moneyChannels,
    pipeline: getFavorites(),
  };

  const html = `
    <div class="results-head">
      <p><b>${list.length}</b> ${escapeHtml(t("studio_found"))} · <b>${escapeHtml(topic)}</b></p>
      <div class="export-group">
        ${csvButton(csvRows, `nichescope-studio-${topic.replace(/\W+/g, "_")}.csv`, t("export_csv"))}
        ${jsonButton(brief, `nichescope-studio-brief-${topic.replace(/\W+/g, "_")}.json`, t("studio_brief"))}
      </div>
    </div>
    <div class="studio-filters" role="group" aria-label="filters">
      <label>${escapeHtml(t("filter_min_cash"))}
        <select id="studio-min-cash-live">
          <option value="0">0+</option>
          <option value="40">40+</option>
          <option value="55">55+</option>
          <option value="70">70+</option>
        </select>
      </label>
      <label class="chk"><input type="checkbox" id="studio-affiliate-live" /> ${escapeHtml(t("filter_affiliate"))}</label>
      <select id="studio-sort-live">
        <option value="cash">${escapeHtml(t("sort_cash"))}</option>
        <option value="opp">${escapeHtml(t("sort_opp"))}</option>
        <option value="views">${escapeHtml(t("sort_views"))}</option>
      </select>
    </div>
    <div class="card-grid">
      ${list.slice(0, 12).map(c => {
        const cls = scoreClass(c.cashScore);
        const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(c.term + " " + topic)}`;
        return `
        <article class="niche-card cash-card">
          <div class="card-top">
            <h3>${escapeHtml(c.term)}</h3>
            <div class="card-top-right">
              ${favBtn("niche", c.term, c.term, { vertical: c.vertical, cashScore: c.cashScore, monthlyMid: c.monthlyMid })}
              <span class="score ${cls}" title="${escapeHtml(t("cash_score"))}">💰 ${c.cashScore}</span>
            </div>
          </div>
          <div class="money-row">
            <div class="money-pill">${escapeHtml(t("est_month"))}: <b>${fmtMoney(c.monthlyMin)}–${fmtMoney(c.monthlyMax)}</b></div>
            <div class="money-pill muted">${escapeHtml(verticalLabel(c.vertical))} · RPM $${c.rpmMin.toFixed(1)}–$${c.rpmMax.toFixed(1)}${c.affiliate ? " · " + t("affiliate") : ""}</div>
          </div>
          <div class="metric-row">
            <div class="metric"><div class="metric-label">${escapeHtml(t("med_views"))}</div><div class="metric-value">${fmtNum(c.medViews)}</div></div>
            <div class="metric"><div class="metric-label">${escapeHtml(t("avg_subs"))}</div><div class="metric-value">${fmtNum(c.avgSubs)}</div></div>
            <div class="metric"><div class="metric-label">${escapeHtml(t("videos"))}</div><div class="metric-value">${c.count}</div></div>
          </div>
          ${c.topChannels?.length ? `
            <div class="niche-section">
              <div class="niche-section-label">${escapeHtml(t("top_channels"))}</div>
              <div class="niche-channels">
                ${c.topChannels.map(ch => `
                  <button type="button" class="niche-channel" data-channel="${escapeHtml(ch.handle || ch.id)}">
                    <span class="ch-name">${escapeHtml(ch.title)}</span>
                    <span class="ch-subs">${fmtNum(ch.subs)} · ${ch.count} vid</span>
                  </button>
                `).join("")}
              </div>
            </div>` : ""}
          <a class="niche-yt-link" href="${ytSearch}" target="_blank" rel="noopener">${escapeHtml(t("search_yt"))}</a>
        </article>`;
      }).join("")}
    </div>
    ${moneyChannels.length ? `
      <div class="section-title">${escapeHtml(t("studio_money_ch"))}</div>
      <div class="card-grid">
        ${moneyChannels.map(ch => `
          <div class="card money-ch-card">
            <div class="card-top">
              <div class="card-title">${escapeHtml(ch.title)}</div>
              ${favBtn("channel", ch.id, ch.title, { vertical: ch.vertical, cashScore: ch.cashHint, monthlyMid: ch.estMid })}
            </div>
            <div class="card-meta">
              <span>${fmtNum(ch.subs)} subs</span>
              <span>· VPS ${(ch.vps || 0).toFixed(2)}</span>
            </div>
            <div class="card-stats">
              <span><b>${fmtNum(ch.avgViews)}</b> avg views</span>
              <button type="button" class="btn-csv analyze-ch" data-channel="${escapeHtml(ch.handle || ch.id)}">${escapeHtml(t("channel_go"))}</button>
            </div>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;
  $("#studio-results").innerHTML = html;

  // Sync filter controls
  const minEl = $("#studio-min-cash-live");
  const affEl = $("#studio-affiliate-live");
  const sortEl = $("#studio-sort-live");
  if (minEl) minEl.value = $("#studio-min-cash")?.value || "0";
  if (affEl) affEl.checked = !!$("#studio-affiliate")?.checked;
  if (sortEl) sortEl.value = $("#studio-sort")?.value || "cash";

  const syncAndRerender = () => {
    if ($("#studio-min-cash") && minEl) $("#studio-min-cash").value = minEl.value;
    if ($("#studio-affiliate") && affEl) $("#studio-affiliate").checked = affEl.checked;
    if ($("#studio-sort") && sortEl) $("#studio-sort").value = sortEl.value;
    renderStudioResults(lastClusters, lastTopic, lastMoneyChannels);
  };
  minEl?.addEventListener("change", syncAndRerender);
  affEl?.addEventListener("change", syncAndRerender);
  sortEl?.addEventListener("change", syncAndRerender);

  wireFavButtons("#studio-results");
  $$("#studio-results .niche-channel, #studio-results .analyze-ch").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab("channel");
      $("#channel-input").value = btn.dataset.channel;
      $("#form-channel").requestSubmit();
    });
  });
}

export async function onStudio(e) {
  e?.preventDefault?.();
  const query = ($("#studio-query")?.value || "").trim();
  const region = $("#studio-region")?.value || "";
  if (!query) return;
  addHistory("studio", query);
  setLoading("#studio-results");
  try {
    const { clusters, videos, channelMap } = await discoverNiches(query, region, getLang());
    if (!clusters.length) return setEmpty("#studio-results", t("no_niches"));

    clusters.sort((a, b) => b.cashScore - a.cashScore);

    // Aggregate money channels across top clusters
    const seen = new Set();
    const moneyChannels = [];
    for (const c of clusters.slice(0, 8)) {
      for (const ch of (c.moneyChannels || [])) {
        if (seen.has(ch.id)) continue;
        seen.add(ch.id);
        const avgViews = ch.count ? ch.views / ch.count : 0;
        moneyChannels.push({
          ...ch,
          avgViews,
          vertical: c.vertical,
          cashHint: c.cashScore,
          estMid: c.monthlyMid * 0.6,
        });
      }
    }
    moneyChannels.sort((a, b) => b.vps - a.vps);

    renderStudioResults(clusters, query, moneyChannels.slice(0, 8));
    // silence unused
    void videos; void channelMap;
  } catch (err) {
    setError("#studio-results", err);
  }
}

let studioWired = false;

export function initStudio() {
  renderPipeline();
  initPlan();
  initAudit();
  if (!studioWired) {
    studioWired = true;
    $("#form-studio")?.addEventListener("submit", onStudio);
  }
  const presets = $("#studio-presets");
  if (presets) {
    presets.innerHTML = STUDIO_PRESETS.map(p =>
      `<button type="button" class="preset-chip" data-q="${escapeHtml(p.query)}">${escapeHtml(t(p.labelKey))}</button>`
    ).join("");
    $$(".preset-chip", presets).forEach(btn => {
      btn.addEventListener("click", () => {
        $("#studio-query").value = btn.dataset.q;
        onStudio({ preventDefault() {} });
      });
    });
  }
}

export { renderPipeline };
