/** Rankings tab — Supabase-backed keyword history (polished UX) */

import { $, $$, escapeHtml, fmtNum, scoreClass, csvButton } from "../utils.js";
import { t, getLang } from "../i18n.js";
import { setLoading, setError, addHistory, switchTab } from "../ui.js";
import {
  isBackendConfigured,
  getSupabaseConfig,
  saveSupabaseConfig,
  listTrackedKeywords,
  addTrackedKeyword,
  removeTrackedKeyword,
  listSnapshots,
  scanTrackedKeyword,
} from "../backend.js";

let sortMode = "recent"; // recent | score | delta | alpha
let cacheRows = [];

function fmtWhen(iso) {
  try {
    return new Date(iso).toLocaleString(getLang() === "en" ? "en-US" : "fr-FR", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtRel(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return fmtWhen(iso);
  const h = ms / 3600000;
  if (h < 1) return getLang() === "en" ? "just now" : "à l’instant";
  if (h < 24) return getLang() === "en" ? `${Math.round(h)}h ago` : `il y a ${Math.round(h)} h`;
  const d = Math.round(h / 24);
  return getLang() === "en" ? `${d}d ago` : `il y a ${d} j`;
}

/** Compact SVG sparkline (oldest → newest left→right) */
function sparkSvg(scores) {
  if (!scores.length) return `<div class="rk-spark-empty muted">—</div>`;
  const vals = [...scores].reverse(); // oldest first for left→right
  const w = 140;
  const h = 36;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const pts = vals.map((v, i) => {
    const x = vals.length === 1 ? w / 2 : (i / (vals.length - 1)) * w;
    const y = h - 4 - ((v - min) / span) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = vals[vals.length - 1];
  const first = vals[0];
  const up = last >= first;
  return `
    <svg class="rk-spark-svg ${up ? "up" : "down"}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${pts}" />
    </svg>
  `;
}

function sortRows(rows) {
  const copy = [...rows];
  copy.sort((a, b) => {
    const la = a.snaps[0];
    const lb = b.snaps[0];
    const sa = la?.overall_score ?? -1;
    const sb = lb?.overall_score ?? -1;
    const da = a.snaps.length >= 2 ? a.snaps[0].overall_score - a.snaps[1].overall_score : -999;
    const db = b.snaps.length >= 2 ? b.snaps[0].overall_score - b.snaps[1].overall_score : -999;
    if (sortMode === "score") return sb - sa;
    if (sortMode === "delta") return db - da;
    if (sortMode === "alpha") return a.kw.keyword.localeCompare(b.kw.keyword);
    // recent: latest snapshot first
    const ta = la ? new Date(la.captured_at).getTime() : 0;
    const tb = lb ? new Date(lb.captured_at).getTime() : 0;
    return tb - ta;
  });
  return copy;
}

function summaryHtml(rows) {
  const withScore = rows.filter(r => r.snaps[0]);
  const avg = withScore.length
    ? Math.round(withScore.reduce((s, r) => s + r.snaps[0].overall_score, 0) / withScore.length)
    : 0;
  let rising = 0;
  let falling = 0;
  rows.forEach(r => {
    if (r.snaps.length < 2) return;
    const d = r.snaps[0].overall_score - r.snaps[1].overall_score;
    if (d > 0) rising++;
    else if (d < 0) falling++;
  });
  const stale = rows.filter(r => {
    const t0 = r.snaps[0]?.captured_at;
    if (!t0) return true;
    return Date.now() - new Date(t0).getTime() > 36 * 3600000;
  }).length;

  return `
    <div class="rk-summary">
      <div class="rk-sum-card">
        <div class="rk-sum-label">${escapeHtml(t("rk_tracked"))}</div>
        <div class="rk-sum-value">${rows.length}</div>
      </div>
      <div class="rk-sum-card">
        <div class="rk-sum-label">${escapeHtml(t("rk_avg_score"))}</div>
        <div class="rk-sum-value"><span class="score ${scoreClass(avg)}">${avg || "—"}</span></div>
      </div>
      <div class="rk-sum-card">
        <div class="rk-sum-label">${escapeHtml(t("rk_rising"))}</div>
        <div class="rk-sum-value rk-delta up">↑ ${rising}</div>
      </div>
      <div class="rk-sum-card">
        <div class="rk-sum-label">${escapeHtml(t("rk_falling"))}</div>
        <div class="rk-sum-value rk-delta down">↓ ${falling}</div>
      </div>
      <div class="rk-sum-card">
        <div class="rk-sum-label">${escapeHtml(t("rk_stale"))}</div>
        <div class="rk-sum-value">${stale}</div>
      </div>
    </div>
  `;
}

function emptyStateHtml() {
  return `
    <div class="rk-empty">
      <h3>${escapeHtml(t("rk_empty_title"))}</h3>
      <p>${escapeHtml(t("rk_empty"))}</p>
      <div class="rk-empty-actions">
        <button type="button" class="btn-primary" id="rk-goto-optimize">${escapeHtml(t("tab_optimize"))}</button>
        <button type="button" class="btn-csv" id="rk-goto-keyword">${escapeHtml(t("tab_keyword"))}</button>
      </div>
      <p class="muted" style="font-size:12px;margin-top:12px;">${escapeHtml(t("rk_cron_hint"))}</p>
    </div>
  `;
}

function paintList(rows) {
  const sorted = sortRows(rows);
  if (!sorted.length) {
    $("#rankings-list").innerHTML = emptyStateHtml();
    $("#rk-goto-optimize")?.addEventListener("click", () => switchTab("optimize"));
    $("#rk-goto-keyword")?.addEventListener("click", () => switchTab("keyword"));
    return;
  }

  const exportRows = sorted.map(({ kw, snaps }) => {
    const latest = snaps[0];
    const delta = snaps.length >= 2 ? snaps[0].overall_score - snaps[1].overall_score : "";
    return {
      keyword: kw.keyword,
      region: kw.region || "WW",
      overall: latest?.overall_score ?? "",
      delta,
      volume: latest?.volume_score ?? "",
      competition: latest?.competition_score ?? "",
      last_scan: latest?.captured_at ?? "",
      snapshots: snaps.length,
    };
  });

  $("#rankings-list").innerHTML = `
    ${summaryHtml(sorted)}
    <div class="results-head rk-toolbar">
      <p><b>${sorted.length}</b> ${escapeHtml(t("rk_tracked"))}</p>
      <div class="rk-toolbar-right">
        <label class="rk-sort">
          <span>${escapeHtml(t("rk_sort"))}</span>
          <select id="rk-sort">
            <option value="recent" ${sortMode === "recent" ? "selected" : ""}>${escapeHtml(t("rk_sort_recent"))}</option>
            <option value="score" ${sortMode === "score" ? "selected" : ""}>${escapeHtml(t("rk_sort_score"))}</option>
            <option value="delta" ${sortMode === "delta" ? "selected" : ""}>${escapeHtml(t("rk_sort_delta"))}</option>
            <option value="alpha" ${sortMode === "alpha" ? "selected" : ""}>${escapeHtml(t("rk_sort_alpha"))}</option>
          </select>
        </label>
        <button type="button" class="btn-csv" id="rk-scan-all">${escapeHtml(t("rk_scan_all"))}</button>
        ${csvButton(exportRows, "nichescope-rankings-overview.csv", t("export_csv"))}
      </div>
    </div>
    <div class="rk-list">
      ${sorted.map(({ kw, snaps }) => {
        const latest = snaps[0];
        const scores = snaps.map(s => s.overall_score);
        const delta = scores.length >= 2 ? scores[0] - scores[1] : null;
        const stale = !latest || (Date.now() - new Date(latest.captured_at).getTime() > 36 * 3600000);
        return `
          <article class="card rk-card ${stale ? "stale" : ""}" data-id="${escapeHtml(kw.id)}">
            <div class="rk-card-main">
              <div class="rk-card-left">
                <div class="card-title">${escapeHtml(kw.keyword)}</div>
                <div class="card-meta">
                  <span class="rk-pill">${escapeHtml(kw.region || "WW")}</span>
                  <span>${escapeHtml(fmtRel(latest?.captured_at))}</span>
                  <span>· ${snaps.length} ${escapeHtml(t("rk_snaps"))}</span>
                  ${stale ? `<span class="rk-stale-pill">${escapeHtml(t("rk_needs_scan"))}</span>` : ""}
                </div>
                ${latest ? `
                  <div class="rk-mini-stats">
                    <span>Vol <b class="score ${scoreClass(latest.volume_score)}">${latest.volume_score}</b></span>
                    <span>Comp <b class="score ${scoreClass(100 - latest.competition_score)}">${latest.competition_score}</b></span>
                    <span>Opp <b>${latest.opportunity_score}</b></span>
                    <span>YT <b>${fmtNum(latest.total_results)}</b></span>
                  </div>
                ` : `<div class="muted" style="font-size:12px;margin-top:6px;">${escapeHtml(t("rk_no_snaps"))}</div>`}
              </div>
              <div class="rk-card-right">
                <div class="rk-score-wrap">
                  ${latest ? `<span class="score rk-big ${scoreClass(latest.overall_score)}">${latest.overall_score}</span>` : `<span class="muted rk-big">—</span>`}
                  ${delta != null ? `<span class="rk-delta ${delta > 0 ? "up" : delta < 0 ? "down" : ""}">${delta > 0 ? "+" : ""}${delta}</span>` : ""}
                </div>
                ${sparkSvg(scores)}
              </div>
            </div>
            <div class="rk-actions">
              <button type="button" class="btn-primary rk-scan" data-id="${escapeHtml(kw.id)}">${escapeHtml(t("rk_scan"))}</button>
              <button type="button" class="btn-csv rk-history" data-id="${escapeHtml(kw.id)}">${escapeHtml(t("rk_history"))}</button>
              <button type="button" class="btn-csv rk-to-opt" data-kw="${escapeHtml(kw.keyword)}">${escapeHtml(t("tab_optimize"))}</button>
              <button type="button" class="btn-csv rk-remove" data-id="${escapeHtml(kw.id)}" title="${escapeHtml(t("rk_remove_confirm"))}">✕</button>
            </div>
            <div class="rk-history-panel" id="rk-hist-${escapeHtml(kw.id)}" hidden></div>
          </article>
        `;
      }).join("")}
    </div>
    <p class="muted rk-footnote">${escapeHtml(t("rk_cron_hint"))}</p>
  `;

  $("#rk-sort")?.addEventListener("change", (e) => {
    sortMode = e.target.value;
    paintList(cacheRows);
  });

  $("#rk-scan-all")?.addEventListener("click", async () => {
    const btn = $("#rk-scan-all");
    btn.disabled = true;
    btn.textContent = t("loading");
    try {
      const ids = sortRows(cacheRows).map(r => r.kw.id).slice(0, 10);
      for (const id of ids) {
        await scanTrackedKeyword(id);
      }
      await renderList();
    } catch (err) {
      alert(err.message || String(err));
      btn.disabled = false;
      btn.textContent = t("rk_scan_all");
    }
  });

  $$("#rankings-list .rk-scan").forEach(btn => {
    btn.addEventListener("click", async () => {
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = t("loading");
      try {
        await scanTrackedKeyword(btn.dataset.id);
        await renderList();
      } catch (err) {
        alert(err.message || String(err));
        btn.disabled = false;
        btn.textContent = label;
      }
    });
  });

  $$("#rankings-list .rk-remove").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm(t("rk_remove_confirm"))) return;
      await removeTrackedKeyword(btn.dataset.id);
      await renderList();
    });
  });

  $$("#rankings-list .rk-to-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab("optimize");
      if ($("#optimize-query")) {
        $("#optimize-query").value = btn.dataset.kw || "";
        $("#form-optimize")?.requestSubmit();
      }
    });
  });

  $$("#rankings-list .rk-history").forEach(btn => {
    btn.addEventListener("click", async () => {
      const panel = $(`#rk-hist-${btn.dataset.id}`);
      if (!panel) return;
      if (!panel.hidden && panel.dataset.loaded) {
        panel.hidden = true;
        return;
      }
      const snaps = await listSnapshots(btn.dataset.id, 30);
      const rows = snaps.map(s => ({
        captured_at: s.captured_at,
        overall: s.overall_score,
        volume: s.volume_score,
        competition: s.competition_score,
        opportunity: s.opportunity_score,
        total_results: s.total_results,
        avg_top_views: s.avg_top_views,
      }));
      const histScores = snaps.map(s => s.overall_score);
      panel.innerHTML = `
        <div class="rk-hist-head">
          <div>
            <div class="section-title" style="margin:0 0 6px;">${escapeHtml(t("rk_history"))}</div>
            ${sparkSvg(histScores)}
          </div>
          ${csvButton(rows, "nichescope-rankings.csv", t("export_csv"))}
        </div>
        <table class="sc-table">
          <thead>
            <tr>
              <th>${escapeHtml(t("rk_when"))}</th>
              <th>Overall</th>
              <th>Vol</th>
              <th>Comp</th>
              <th>Opp</th>
              <th>${escapeHtml(t("rk_results"))}</th>
            </tr>
          </thead>
          <tbody>
            ${snaps.map((s, i) => {
              const prev = snaps[i + 1];
              const d = prev ? s.overall_score - prev.overall_score : null;
              return `
                <tr>
                  <td>${escapeHtml(fmtWhen(s.captured_at))}</td>
                  <td>
                    <span class="score ${scoreClass(s.overall_score)}">${s.overall_score}</span>
                    ${d != null ? `<span class="rk-delta ${d > 0 ? "up" : d < 0 ? "down" : ""}">${d > 0 ? "+" : ""}${d}</span>` : ""}
                  </td>
                  <td>${s.volume_score}</td>
                  <td>${s.competition_score}</td>
                  <td>${s.opportunity_score}</td>
                  <td>${fmtNum(s.total_results)}</td>
                </tr>
              `;
            }).join("") || `<tr><td colspan="6" class="muted">${escapeHtml(t("rk_no_snaps"))}</td></tr>`}
          </tbody>
        </table>
      `;
      panel.hidden = false;
      panel.dataset.loaded = "1";
    });
  });
}

async function renderList() {
  if (!isBackendConfigured()) {
    $("#rankings-list").innerHTML = "";
    return;
  }
  setLoading("#rankings-list");
  try {
    const keywords = await listTrackedKeywords();
    const withSnaps = await Promise.all(keywords.map(async (kw) => {
      const snaps = await listSnapshots(kw.id, 14);
      return { kw, snaps };
    }));
    cacheRows = withSnaps;
    paintList(cacheRows);
  } catch (err) {
    setError("#rankings-list", err);
  }
}

function renderSetupState() {
  const configured = isBackendConfigured();
  const cfg = getSupabaseConfig();
  $("#rankings-setup")?.classList.toggle("hidden", configured);
  $("#rankings-main")?.classList.toggle("hidden", !configured);
  $("#rankings-status")?.classList.toggle("hidden", !configured);
  if ($("#sb-url")) $("#sb-url").value = cfg.url;
  if ($("#sb-anon")) $("#sb-anon").value = cfg.anonKey;

  const statusEl = $("#rankings-status");
  if (statusEl && configured) {
    const host = (() => {
      try { return new URL(cfg.url).host; } catch { return "Supabase"; }
    })();
    statusEl.innerHTML = `
      <div class="rk-status-left">
        <span class="rk-dot"></span>
        <span>${escapeHtml(t("rk_connected"))} · <b>${escapeHtml(host)}</b></span>
        <span class="muted">· ${escapeHtml(t("rk_cron_hint_short"))}</span>
      </div>
      <div class="rk-status-right">
        <button type="button" class="btn-csv" id="rk-refresh">${escapeHtml(t("rk_refresh"))}</button>
        <button type="button" class="btn-csv" id="rk-edit-backend">${escapeHtml(t("rk_settings"))}</button>
      </div>
    `;
    $("#rk-refresh")?.addEventListener("click", () => renderList());
    $("#rk-edit-backend")?.addEventListener("click", () => {
      $("#rankings-setup")?.classList.remove("hidden");
      $("#rankings-setup")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
}

export async function onTrackKeyword(e) {
  e?.preventDefault?.();
  if (!isBackendConfigured()) return;
  const keyword = ($("#rk-keyword")?.value || "").trim();
  if (!keyword) return;
  const region = $("#rk-region")?.value || "";
  const btn = $("#form-rankings button[type=submit]");
  addHistory("rankings", keyword);
  if (btn) {
    btn.disabled = true;
    btn.textContent = t("loading");
  }
  try {
    const row = await addTrackedKeyword({ keyword, region, lang: getLang() });
    $("#rk-keyword").value = "";
    await scanTrackedKeyword(row.id);
    await renderList();
  } catch (err) {
    alert(err.message || String(err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = t("rk_track");
    }
  }
}

export function saveBackendSettings(e) {
  e?.preventDefault?.();
  const url = $("#sb-url")?.value || "";
  const anonKey = $("#sb-anon")?.value || "";
  saveSupabaseConfig({ url, anonKey });
  renderSetupState();
  if (isBackendConfigured()) {
    $("#rankings-setup")?.classList.add("hidden");
    renderList();
  }
}

export function disconnectBackend() {
  if (!confirm(t("rk_disconnect_confirm"))) return;
  saveSupabaseConfig({ url: "", anonKey: "" });
  cacheRows = [];
  renderSetupState();
  $("#rankings-list").innerHTML = "";
}

let wired = false;
export function initRankings() {
  if (wired) return;
  wired = true;
  renderSetupState();
  $("#form-rankings-setup")?.addEventListener("submit", saveBackendSettings);
  $("#form-rankings")?.addEventListener("submit", onTrackKeyword);
  $("#rk-disconnect")?.addEventListener("click", disconnectBackend);
  if (isBackendConfigured()) renderList();
}

/** Re-render when user opens the tab */
export function refreshRankingsIfConfigured() {
  if (isBackendConfigured()) renderList();
}
