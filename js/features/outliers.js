import { resolveChannel, fetchRecentVideos } from "../api.js";
import { $, escapeHtml, fmtNum, fmtDate, fmtDuration, filterByFormat, median, csvButton } from "../utils.js";
import { t } from "../i18n.js";
import { addHistory, setLoading, setError, setEmpty } from "../ui.js";

export async function onOutliers(e) {
  e.preventDefault();
  const raw = $("#outliers-input").value.trim();
  const threshold = parseFloat($("#outliers-threshold").value);
  const format = $("#outliers-format").value;
  if (!raw) return;
  addHistory("outliers", `${raw} · ≥${threshold}× · ${format}`);
  setLoading("#outliers-results");
  try {
    const channel = await resolveChannel(raw);
    if (!channel) return setEmpty("#outliers-results", t("err_not_found"));
    const recent = await fetchRecentVideos(channel, 50);
    const filtered = filterByFormat(recent, format);
    if (!filtered.length) return setEmpty("#outliers-results", t("no_results"));

    const med = median(filtered.map(v => v.views));
    if (!med) return setEmpty("#outliers-results", t("no_results"));

    const outliers = filtered
      .map(v => ({ ...v, multiplier: v.views / med }))
      .filter(v => v.multiplier >= threshold)
      .sort((a, b) => b.multiplier - a.multiplier);

    if (!outliers.length) {
      return setEmpty("#outliers-results", `No videos ≥ ${threshold}× (${fmtNum(med)}).`);
    }
    renderOutliers(channel, outliers, med, threshold, format);
  } catch (err) {
    setError("#outliers-results", err);
  }
}

function renderOutliers(channel, outliers, med, threshold, format) {
  const sn = channel.snippet || {};
  const csvRows = outliers.map(v => ({
    title: v.title, views: v.views, multiplier_x: v.multiplier.toFixed(1),
    likes: v.likes, duration_sec: v.duration,
    published: v.publishedAt, url: `https://www.youtube.com/watch?v=${v.id}`,
  }));

  $("#outliers-results").innerHTML = `
    <div class="results-head">
      <p><b>${escapeHtml(sn.title)}</b> · médiane <b>${fmtNum(med)}</b> · <b>${outliers.length}</b> ≥ ${threshold}×</p>
      ${csvButton(csvRows, `nichescope-outliers-${(sn.title || "x").replace(/\W+/g, "_")}.csv`, t("export_csv"))}
    </div>
    <div class="card-grid">
      ${outliers.map(v => `
        <article class="card" style="position:relative;">
          <span class="outlier-badge">${v.multiplier.toFixed(1)}×</span>
          <a class="card-thumb" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">
            ${v.thumb ? `<img loading="lazy" src="${v.thumb}" alt="">` : ""}
          </a>
          <div class="card-title"><a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${escapeHtml(v.title)}</a></div>
          <div class="card-meta"><span>${fmtDate(v.publishedAt)}</span><span>· ${fmtDuration(v.duration)}</span></div>
          <div class="card-stats"><span><b>${fmtNum(v.views)}</b></span><span><b>${fmtNum(v.likes)}</b></span></div>
        </article>
      `).join("")}
    </div>
  `;
  void format;
}
