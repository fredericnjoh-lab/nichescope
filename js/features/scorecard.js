/** Competitor Scorecard tab — compare up to 4 channels */

import { resolveChannel, fetchRecentVideos, friendly } from "../api.js";
import {
  $, escapeHtml, fmtNum, fmtMoney, csvButton, scoreClass,
} from "../utils.js";
import { t, verticalLabel, getLang } from "../i18n.js";
import { addHistory, setLoading, setError, setEmpty } from "../ui.js";
import { getFavorites } from "../favorites.js";
import {
  buildChannelScorecard,
  compareScorecards,
  scorecardToRow,
} from "../scorecard.js";

function isBest(cardId, leader) {
  return leader?.id && leader.id === cardId ? "best" : "";
}

function renderScorecard(cards) {
  const leaders = compareScorecards(cards);
  const rows = cards.map(scorecardToRow);
  const L = getLang() === "en";

  const matrix = [
    { key: "competitorScore", label: t("sc_score"), fmt: c => c.competitorScore, lead: leaders.bestCompetitorScore },
    { key: "cash", label: t("cash_score"), fmt: c => c.money.cashScore, lead: leaders.bestCash },
    { key: "subs", label: "Subs", fmt: c => fmtNum(c.money.subs), lead: leaders.bestSubs },
    { key: "avg30", label: t("sc_avg30"), fmt: c => fmtNum(c.money.avgViews30d), lead: leaders.bestAvg30 },
    { key: "upw", label: t("sc_uploads"), fmt: c => c.money.uploadsPerWeek.toFixed(1), lead: leaders.bestUploads },
    { key: "eng", label: t("sc_engagement"), fmt: c => c.engagementPct.toFixed(2) + "%", lead: leaders.bestEngagement },
    { key: "growth", label: t("sc_growth"), fmt: c => (c.growthProxy >= 0 ? "+" : "") + c.growthProxy.toFixed(0) + "%", lead: leaders.bestGrowth },
    { key: "outliers", label: t("sc_outliers"), fmt: c => String(c.outlierCount), lead: leaders.bestOutliers },
    { key: "shorts", label: "Shorts %", fmt: c => Math.round(c.money.shortsRatio * 100) + "%" },
    { key: "adsense", label: t("est_adsense_30"), fmt: c => `${fmtMoney(c.money.monetMin)}–${fmtMoney(c.money.monetMax)}`, lead: leaders.bestMonet },
    { key: "vertical", label: t("vertical"), fmt: c => verticalLabel(c.money.vertical) },
  ];

  $("#scorecard-results").innerHTML = `
    <div class="results-head">
      <p>${escapeHtml(t("sc_compare_lead"))} · <b>${cards.length}</b> ${L ? "channels" : "chaînes"}</p>
      ${csvButton(rows, "nichescope-scorecard.csv", t("export_csv"))}
    </div>

    <div class="sc-header-grid">
      ${cards.map(c => `
        <div class="sc-channel-head">
          ${c.avatar ? `<img src="${c.avatar}" alt="">` : ""}
          <div>
            <div class="ch-name">${escapeHtml(c.title)}</div>
            <div class="ch-handle">${escapeHtml(c.handle || "")}</div>
            <span class="score ${scoreClass(c.competitorScore)}">${c.competitorScore}</span>
          </div>
        </div>
      `).join("")}
    </div>

    <div class="sc-table-wrap">
      <table class="sc-table">
        <thead>
          <tr>
            <th>${escapeHtml(t("sc_metric"))}</th>
            ${cards.map(c => `<th>${escapeHtml(c.title)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${matrix.map(m => `
            <tr>
              <td class="sc-metric">${escapeHtml(m.label)}</td>
              ${cards.map(c => `
                <td class="${m.lead ? isBest(c.id, m.lead) : ""}">${escapeHtml(String(m.fmt(c)))}</td>
              `).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="section-title">${escapeHtml(t("sc_keywords"))}</div>
    <div class="sc-kw-grid">
      ${cards.map(c => `
        <div class="sc-kw-col">
          <div class="ch-name">${escapeHtml(c.title)}</div>
          <div class="niche-keywords">
            ${c.topKeywords.length
              ? c.topKeywords.map(k => `<span class="kw-tag">${escapeHtml(k.term)}</span>`).join("")
              : "—"}
          </div>
        </div>
      `).join("")}
    </div>

    <div class="section-title">${escapeHtml(t("sc_outliers_section"))}</div>
    <div class="sc-outlier-grid">
      ${cards.map(c => `
        <div class="sc-kw-col">
          <div class="ch-name">${escapeHtml(c.title)} · ${c.outlierCount}</div>
          <ul class="seo-questions">
            ${(c.outliers || []).slice(0, 3).map(o => `
              <li>
                <a href="https://www.youtube.com/watch?v=${o.id}" target="_blank" rel="noopener">
                  <b>${(o.views / (c.money.medianViews || 1)).toFixed(1)}×</b> ${escapeHtml(o.title)}
                </a>
                <span class="muted"> · ${fmtNum(o.views)}</span>
              </li>
            `).join("") || `<li class="muted">—</li>`}
          </ul>
        </div>
      `).join("")}
    </div>

    <p class="muted" style="font-size:12px;margin-top:16px;">${escapeHtml(t("sc_disclaimer"))}</p>
  `;
}

export async function onScorecard(e) {
  e?.preventDefault?.();
  const raw = ($("#scorecard-input")?.value || "").trim();
  if (!raw) return;
  addHistory("scorecard", raw);

  const inputs = raw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 4);
  if (inputs.length < 1) return setEmpty("#scorecard-results", t("sc_need_channels"));

  setLoading("#scorecard-results");
  try {
    const settled = await Promise.all(inputs.map(async (input) => {
      try {
        const channel = await resolveChannel(input);
        if (!channel) return { input, error: t("err_not_found") };
        const recent = await fetchRecentVideos(channel, 50);
        return { input, card: buildChannelScorecard(channel, recent) };
      } catch (err) {
        return { input, error: friendly(err) };
      }
    }));

    const errors = settled.filter(r => r.error);
    const cards = settled.filter(r => r.card).map(r => r.card);
    if (!cards.length) {
      return setEmpty("#scorecard-results", errors.map(e => `${e.input}: ${e.error}`).join(" · ") || t("no_results"));
    }
    renderScorecard(cards);
    if (errors.length) {
      $("#scorecard-results").insertAdjacentHTML("afterbegin",
        `<div class="error" style="margin-bottom:12px;">${errors.map(e => escapeHtml(`${e.input}: ${e.error}`)).join(" · ")}</div>`);
    }
  } catch (err) {
    setError("#scorecard-results", err);
  }
}

export function fillFromPipeline() {
  const channels = getFavorites().filter(f => f.type === "channel").slice(0, 4);
  if (!channels.length) {
    alert(t("sc_pipeline_empty"));
    return;
  }
  $("#scorecard-input").value = channels.map(c => c.id || c.title).join(", ");
}

let wired = false;
export function initScorecard() {
  if (wired) return;
  wired = true;
  $("#form-scorecard")?.addEventListener("submit", onScorecard);
  $("#scorecard-from-pipeline")?.addEventListener("click", fillFromPipeline);
}
