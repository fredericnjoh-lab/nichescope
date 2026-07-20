/** Studio Plan — calendar + title/thumb briefs from pipeline outliers */

import { resolveChannel, fetchRecentVideos } from "../api.js";
import {
  $, escapeHtml, median, csvButton, jsonButton, filterByFormat,
} from "../utils.js";
import { t, getLang } from "../i18n.js";
import { setLoading, setError, setEmpty, addHistory } from "../ui.js";
import { getFavorites } from "../favorites.js";
import { buildStudioPlan } from "../editorial.js";
import { setLastPlan, getLastPlan } from "../session.js";

let lastPlan = null;

async function collectOutliersFromPipeline(threshold = 2.5) {
  const favs = getFavorites();
  const channels = favs.filter(f => f.type === "channel").slice(0, 3);
  const niches = favs.filter(f => f.type === "niche");
  const outliers = [];
  const sources = [];

  for (const fav of channels) {
    try {
      const candidates = [
        fav.id,
        fav.meta?.handle,
        fav.title,
      ].filter(Boolean);
      let channel = null;
      for (const c of candidates) {
        channel = await resolveChannel(c);
        if (channel) break;
      }
      if (!channel) continue;

      const recent = await fetchRecentVideos(channel, 50);
      const long = filterByFormat(recent, "long");
      const pool = long.length >= 8 ? long : recent;
      const med = median(pool.map(v => v.views));
      if (!med) continue;
      const outs = pool
        .map(v => ({ ...v, multiplier: v.views / med, channelTitle: channel.snippet?.title }))
        .filter(v => v.multiplier >= threshold)
        .sort((a, b) => b.multiplier - a.multiplier)
        .slice(0, 8);
      outliers.push(...outs);
      sources.push({ channel: channel.snippet?.title, count: outs.length, median: med });
    } catch {
      /* skip broken channel */
    }
  }

  return { outliers, niches, sources, favs };
}

function weekdayLabel(iso, lang) {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString(lang === "en" ? "en-US" : "fr-FR", {
      weekday: "short", day: "numeric", month: "short",
    });
  } catch {
    return iso;
  }
}

function renderPlan(plan, meta = {}) {
  lastPlan = plan;
  setLastPlan(plan);
  const { analysis, briefs, calendar } = plan;
  const lang = getLang();

  const csvRows = calendar.slots.map(s => ({
    week: s.week,
    date: s.date,
    format: s.format,
    title: s.title,
    pattern: s.pattern || "",
    topic: s.topic || "",
    thumb_overlay: s.thumb?.overlayText || "",
    thumb_emotion: s.thumb?.emotion || "",
    inspired_by: s.inspiredBy || "",
    score: s.score ?? "",
  }));

  const exportPkg = {
    ...plan,
    meta: {
      ...meta,
      exportedAt: new Date().toISOString(),
      pipeline: getFavorites(),
    },
  };

  const patterns = (analysis.rankedPatterns || [])
    .slice(0, 5)
    .map(p => `<span class="kw-tag">${escapeHtml(p.id)}</span>`)
    .join("");

  $("#studio-plan-results").innerHTML = `
    <div class="results-head">
      <p>
        <b>${calendar.slots.length}</b> ${escapeHtml(t("plan_slots"))}
        · ${escapeHtml(t("plan_from_outliers"))}: <b>${meta.outlierCount || 0}</b>
        ${meta.sources?.length ? ` · ${meta.sources.map(s => escapeHtml(s.channel)).join(", ")}` : ""}
      </p>
      <div class="export-group">
        ${csvButton(csvRows, "nichescope-editorial-calendar.csv", t("export_csv"))}
        ${jsonButton(exportPkg, "nichescope-studio-plan.json", t("plan_export"))}
      </div>
    </div>

    ${analysis.count || analysis.topTerms?.length ? `
      <div class="plan-insights">
        <div class="insight">
          <div class="insight-label">${escapeHtml(t("plan_patterns"))}</div>
          <div class="niche-keywords">${patterns || "—"}</div>
        </div>
        <div class="insight">
          <div class="insight-label">${escapeHtml(t("plan_terms"))}</div>
          <div class="niche-keywords">
            ${(analysis.topTerms || []).slice(0, 8).map(term =>
              `<span class="kw-tag">${escapeHtml(term)}</span>`
            ).join("") || "—"}
          </div>
        </div>
        <div class="insight">
          <div class="insight-label">${escapeHtml(t("plan_avg_mult"))}</div>
          <div class="insight-value">${analysis.avgMultiplier ? analysis.avgMultiplier.toFixed(1) + "×" : "—"}</div>
        </div>
      </div>
    ` : ""}

    <div class="section-title">${escapeHtml(t("plan_calendar"))}</div>
    <div class="calendar-grid">
      ${calendar.slots.map(s => `
        <article class="cal-card format-${s.format}">
          <div class="cal-date">
            <span class="cal-week">S${s.week}</span>
            ${escapeHtml(weekdayLabel(s.date, lang))}
          </div>
          <span class="cal-format">${s.format === "shorts" ? "Shorts" : "Long"}</span>
          <h4 class="cal-title">${escapeHtml(s.title)}</h4>
          ${s.thumb ? `
            <div class="thumb-brief">
              <div class="thumb-mock" aria-hidden="true">
                <span class="thumb-overlay">${escapeHtml(s.thumb.overlayText)}</span>
                <span class="thumb-emo">${escapeHtml(s.thumb.emotion)}</span>
              </div>
              <p class="thumb-comp">${escapeHtml(s.thumb.composition)}</p>
            </div>
          ` : ""}
          ${s.inspiredBy ? `
            <div class="cal-inspired">
              ${s.inspiredUrl
                ? `<a href="${s.inspiredUrl}" target="_blank" rel="noopener">${escapeHtml(t("plan_inspired"))}: ${escapeHtml(s.inspiredBy.slice(0, 48))}${(s.inspiredBy.length > 48 ? "…" : "")}</a>`
                : `<span>${escapeHtml(t("plan_inspired"))}: ${escapeHtml(s.inspiredBy.slice(0, 48))}</span>`}
            </div>
          ` : ""}
        </article>
      `).join("")}
    </div>

    <div class="section-title">${escapeHtml(t("plan_titles"))}</div>
    <div class="brief-list">
      ${briefs.map(b => `
        <article class="brief-card">
          <div class="card-top">
            <span class="score ${b.score >= 70 ? "high" : b.score >= 50 ? "med" : "low"}">${b.score}</span>
            <span class="kw-tag">${escapeHtml(b.pattern)}</span>
            <span class="kw-tag">${b.format === "shorts" ? "Shorts" : "Long"}</span>
          </div>
          <h4>${escapeHtml(b.title)}</h4>
          <div class="thumb-brief dense">
            <div class="thumb-mock sm" aria-hidden="true">
              <span class="thumb-overlay">${escapeHtml(b.thumb.overlayText)}</span>
            </div>
            <ul class="thumb-check">
              ${b.thumb.checklist.slice(0, 3).map(c => `<li>${escapeHtml(c)}</li>`).join("")}
            </ul>
          </div>
          <p class="muted thumb-colors">${escapeHtml(b.thumb.colors)}</p>
          ${b.inspiredBy ? `<p class="cal-inspired">${escapeHtml(t("plan_inspired"))}: ${escapeHtml(b.inspiredBy)}</p>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

export async function onGeneratePlan(e) {
  e?.preventDefault?.();
  const favs = getFavorites();
  if (!favs.length) {
    $("#studio-plan-results").innerHTML =
      `<div class="empty">${escapeHtml(t("plan_need_pipeline"))}</div>`;
    return;
  }

  const perWeek = parseInt($("#plan-cadence")?.value || "3", 10);
  const weeks = parseInt($("#plan-weeks")?.value || "4", 10);
  addHistory("studio", `plan · ${perWeek}/w · ${weeks}w`);
  setLoading("#studio-plan-results");

  try {
    const { outliers, niches, sources } = await collectOutliersFromPipeline(2.5);
    const topic = ($("#studio-query")?.value || "").trim()
      || niches[0]?.title
      || "";

    if (!outliers.length && !niches.length) {
      return setEmpty("#studio-plan-results", t("plan_need_pipeline"));
    }

    // If no outliers yet (only niches), still generate from niche titles
    const plan = buildStudioPlan({
      outliers,
      niches,
      topic,
      lang: getLang(),
      perWeek,
      weeks,
      titleCount: Math.max(perWeek * weeks, 6),
    });

    renderPlan(plan, {
      outlierCount: outliers.length,
      sources,
      note: outliers.length
        ? null
        : t("plan_niche_only"),
    });

    if (!outliers.length) {
      const head = $("#studio-plan-results .results-head p");
      if (head) {
        head.insertAdjacentHTML("beforeend",
          ` <span class="money-pill muted">${escapeHtml(t("plan_niche_only"))}</span>`);
      }
    }
  } catch (err) {
    setError("#studio-plan-results", err);
  }
}

let planWired = false;

export function initPlan() {
  if (planWired) return;
  planWired = true;
  $("#form-plan")?.addEventListener("submit", onGeneratePlan);
}

export { lastPlan, renderPlan, getLastPlan };
