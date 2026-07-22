/** Rankings tab — Supabase-backed keyword history */

import { $, $$, escapeHtml, fmtNum, scoreClass, csvButton } from "../utils.js";
import { t, getLang } from "../i18n.js";
import { setLoading, setError, setEmpty, addHistory } from "../ui.js";
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

function fmtWhen(iso) {
  try {
    return new Date(iso).toLocaleString(getLang() === "en" ? "en-US" : "fr-FR", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function spark(scores) {
  if (!scores.length) return "";
  const max = Math.max(...scores, 1);
  const bars = [...scores].reverse().map(s => {
    const h = Math.max(4, Math.round((s / max) * 28));
    return `<span class="rk-bar" style="height:${h}px" title="${s}"></span>`;
  }).join("");
  return `<div class="rk-spark" aria-hidden="true">${bars}</div>`;
}

async function renderList() {
  if (!isBackendConfigured()) {
    $("#rankings-list").innerHTML = "";
    return;
  }
  setLoading("#rankings-list");
  try {
    const keywords = await listTrackedKeywords();
    if (!keywords.length) {
      return setEmpty("#rankings-list", t("rk_empty"));
    }

    const withSnaps = await Promise.all(keywords.map(async (kw) => {
      const snaps = await listSnapshots(kw.id, 14);
      return { kw, snaps };
    }));

    $("#rankings-list").innerHTML = `
      <div class="results-head">
        <p><b>${keywords.length}</b> ${escapeHtml(t("rk_tracked"))}</p>
      </div>
      <div class="rk-list">
        ${withSnaps.map(({ kw, snaps }) => {
          const latest = snaps[0];
          const scores = snaps.map(s => s.overall_score);
          const delta = scores.length >= 2 ? scores[0] - scores[1] : null;
          return `
            <article class="card rk-card" data-id="${escapeHtml(kw.id)}">
              <div class="card-top">
                <div>
                  <div class="card-title">${escapeHtml(kw.keyword)}</div>
                  <div class="card-meta">
                    <span>${escapeHtml(kw.region || "WW")}</span>
                    ${latest ? `<span>· ${escapeHtml(fmtWhen(latest.captured_at))}</span>` : ""}
                  </div>
                </div>
                <div class="card-top-right">
                  ${latest ? `<span class="score ${scoreClass(latest.overall_score)}">${latest.overall_score}</span>` : `<span class="muted">—</span>`}
                  ${delta != null ? `<span class="rk-delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "+" : ""}${delta}</span>` : ""}
                </div>
              </div>
              ${spark(scores)}
              <div class="rk-actions">
                <button type="button" class="btn-primary rk-scan" data-id="${escapeHtml(kw.id)}">${escapeHtml(t("rk_scan"))}</button>
                <button type="button" class="btn-csv rk-history" data-id="${escapeHtml(kw.id)}">${escapeHtml(t("rk_history"))}</button>
                <button type="button" class="btn-csv rk-remove" data-id="${escapeHtml(kw.id)}">✕</button>
              </div>
              <div class="rk-history-panel" id="rk-hist-${escapeHtml(kw.id)}" hidden></div>
            </article>
          `;
        }).join("")}
      </div>
    `;

    $$("#rankings-list .rk-scan").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await scanTrackedKeyword(btn.dataset.id);
          await renderList();
        } catch (err) {
          alert(err.message || String(err));
          btn.disabled = false;
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
        panel.innerHTML = `
          <div class="results-head" style="margin-top:10px;">
            <p>${escapeHtml(t("rk_history"))}</p>
            ${csvButton(rows, "nichescope-rankings.csv", t("export_csv"))}
          </div>
          <table class="sc-table">
            <thead>
              <tr>
                <th>${escapeHtml(t("rk_when"))}</th>
                <th>Overall</th>
                <th>Vol</th>
                <th>Comp</th>
                <th>${escapeHtml(t("rk_results"))}</th>
              </tr>
            </thead>
            <tbody>
              ${snaps.map(s => `
                <tr>
                  <td>${escapeHtml(fmtWhen(s.captured_at))}</td>
                  <td class="score ${scoreClass(s.overall_score)}">${s.overall_score}</td>
                  <td>${s.volume_score}</td>
                  <td>${s.competition_score}</td>
                  <td>${fmtNum(s.total_results)}</td>
                </tr>
              `).join("") || `<tr><td colspan="5" class="muted">${escapeHtml(t("rk_no_snaps"))}</td></tr>`}
            </tbody>
          </table>
        `;
        panel.hidden = false;
        panel.dataset.loaded = "1";
      });
    });
  } catch (err) {
    setError("#rankings-list", err);
  }
}

function renderSetupState() {
  const configured = isBackendConfigured();
  const cfg = getSupabaseConfig();
  $("#rankings-setup")?.classList.toggle("hidden", configured);
  $("#rankings-main")?.classList.toggle("hidden", !configured);
  if ($("#sb-url")) $("#sb-url").value = cfg.url;
  if ($("#sb-anon")) $("#sb-anon").value = cfg.anonKey;
}

export async function onTrackKeyword(e) {
  e?.preventDefault?.();
  if (!isBackendConfigured()) return;
  const keyword = ($("#rk-keyword")?.value || "").trim();
  if (!keyword) return;
  const region = $("#rk-region")?.value || "";
  addHistory("rankings", keyword);
  try {
    const row = await addTrackedKeyword({ keyword, region, lang: getLang() });
    $("#rk-keyword").value = "";
    await scanTrackedKeyword(row.id);
    await renderList();
  } catch (err) {
    alert(err.message || String(err));
  }
}

export function saveBackendSettings(e) {
  e?.preventDefault?.();
  const url = $("#sb-url")?.value || "";
  const anonKey = $("#sb-anon")?.value || "";
  saveSupabaseConfig({ url, anonKey });
  renderSetupState();
  if (isBackendConfigured()) {
    renderList();
    alert(t("rk_saved"));
  }
}

let wired = false;
export function initRankings() {
  if (wired) return;
  wired = true;
  renderSetupState();
  $("#form-rankings-setup")?.addEventListener("submit", saveBackendSettings);
  $("#form-rankings")?.addEventListener("submit", onTrackKeyword);
  if (isBackendConfigured()) renderList();
}
