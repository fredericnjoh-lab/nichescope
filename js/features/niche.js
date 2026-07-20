import { $, $$, escapeHtml, fmtNum, fmtMoney, scoreClass, csvButton } from "../utils.js";
import { t, verticalLabel, getLang } from "../i18n.js";
import { addHistory, setLoading, setError, setEmpty, switchTab } from "../ui.js";
import { discoverNiches } from "./discover.js";
import { toggleFavorite, isFavorite } from "../favorites.js";
import { renderPipeline } from "./studio.js";

export async function onNiche(e) {
  e.preventDefault();
  const query = $("#niche-query").value.trim();
  const region = $("#niche-region").value;
  if (!query) return;
  addHistory("niche", query);
  setLoading("#niche-results");
  try {
    const { clusters } = await discoverNiches(query, region, getLang());
    if (!clusters.length) return setEmpty("#niche-results", t("no_niches"));
    clusters.sort((a, b) => b.score - a.score);
    renderNiches(clusters.slice(0, 12), query);
  } catch (err) {
    setError("#niche-results", err);
  }
}

function renderNiches(clusters, topic) {
  const csvRows = clusters.map(c => ({
    sub_niche: c.term,
    score: c.score,
    cash_score: c.cashScore,
    vertical: c.vertical,
    est_monthly_min: Math.round(c.monthlyMin),
    est_monthly_max: Math.round(c.monthlyMax),
    video_count: c.count,
    avg_views: Math.round(c.avgViews),
    median_views: Math.round(c.medViews),
    avg_subs: Math.round(c.avgSubs),
    avg_views_per_day: Math.round(c.avgVPD),
    top_channels: (c.topChannels || []).map(ch => ch.title).join(" | "),
  }));

  $("#niche-results").innerHTML = `
    <div class="results-head">
      <p><b>${clusters.length}</b> · Cash Score + opportunité</p>
      ${csvButton(csvRows, `nichescope-niches-${topic.replace(/\W+/g, "_")}.csv`, t("export_csv"))}
    </div>
    <div class="card-grid">
      ${clusters.map(c => {
        const cls = scoreClass(c.cashScore);
        const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(c.term + " " + topic)}`;
        const favOn = isFavorite("niche", c.term);
        return `
        <article class="niche-card">
          <div class="card-top">
            <h3>${escapeHtml(c.term)}</h3>
            <div class="card-top-right">
              <button type="button" class="btn-fav ${favOn ? "on" : ""}" data-term="${escapeHtml(c.term)}" data-meta='${escapeHtml(JSON.stringify({ vertical: c.vertical, cashScore: c.cashScore, monthlyMid: c.monthlyMid }))}' aria-pressed="${favOn}">${favOn ? "★" : "☆"}</button>
              <span class="score ${cls}">💰 ${c.cashScore}</span>
            </div>
          </div>
          <div class="money-row">
            <div class="money-pill">${fmtMoney(c.monthlyMin)}–${fmtMoney(c.monthlyMax)}/mo · ${escapeHtml(verticalLabel(c.vertical))}</div>
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
                    <span class="ch-subs">${fmtNum(ch.subs)} · ${ch.count}</span>
                  </button>
                `).join("")}
              </div>
            </div>` : ""}
          ${c.sampleTitles?.length ? `
            <div class="niche-section">
              <div class="niche-section-label">${escapeHtml(t("sample_titles"))}</div>
              <ul class="niche-titles">${c.sampleTitles.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
            </div>` : ""}
          <a class="niche-yt-link" href="${ytSearch}" target="_blank" rel="noopener">${escapeHtml(t("search_yt"))}</a>
        </article>`;
      }).join("")}
    </div>
  `;

  $$("#niche-results .niche-channel").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab("channel");
      $("#channel-input").value = btn.dataset.channel;
      $("#form-channel").requestSubmit();
    });
  });
  $$("#niche-results .btn-fav").forEach(btn => {
    btn.addEventListener("click", () => {
      let meta = {};
      try { meta = JSON.parse(btn.dataset.meta || "{}"); } catch { /* */ }
      toggleFavorite({ type: "niche", id: btn.dataset.term, title: btn.dataset.term, meta });
      renderPipeline();
      renderNiches(clusters, topic);
    });
  });
}
