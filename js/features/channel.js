import { resolveChannel, fetchRecentVideos } from "../api.js";
import {
  $, escapeHtml, fmtNum, fmtMoney, fmtDate, fmtDuration,
  filterByFormat, csvButton, scoreClass,
} from "../utils.js";
import { t, verticalLabel } from "../i18n.js";
import { addHistory, setLoading, setError, setEmpty } from "../ui.js";
import { scoreChannelMoney } from "../money.js";
import { toggleFavorite, isFavorite } from "../favorites.js";
import { renderPipeline } from "./studio.js";
import { friendly } from "../api.js";

export async function onChannel(e) {
  e.preventDefault();
  const raw = $("#channel-input").value.trim();
  const format = $("#channel-format").value;
  if (!raw) return;
  addHistory("channel", raw);
  const inputs = raw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3);
  setLoading("#channel-results");
  try {
    if (inputs.length === 1) {
      const channel = await resolveChannel(inputs[0]);
      if (!channel) return setEmpty("#channel-results", t("err_not_found"));
      const recent = await fetchRecentVideos(channel);
      renderChannel(channel, filterByFormat(recent, format), recent, format);
    } else {
      const results = await Promise.all(inputs.map(async (input) => {
        try {
          const channel = await resolveChannel(input);
          if (!channel) return { input, error: t("err_not_found") };
          const recent = await fetchRecentVideos(channel);
          return { input, channel, recent };
        } catch (err) {
          return { input, error: friendly(err) };
        }
      }));
      renderChannelCompare(results, format);
    }
  } catch (err) {
    setError("#channel-results", err);
  }
}

function renderChannel(channel, recentFiltered, recentAll, format) {
  const sn = channel.snippet || {};
  const s = scoreChannelMoney(channel, recentAll);
  const avatar = sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url;
  const favOn = isFavorite("channel", channel.id);
  const csvRows = recentFiltered.map(v => ({
    title: v.title, views: v.views, likes: v.likes, duration_sec: v.duration,
    published: v.publishedAt, url: `https://www.youtube.com/watch?v=${v.id}`,
  }));

  $("#channel-results").innerHTML = `
    <div class="channel-header">
      ${avatar ? `<img src="${avatar}" alt="">` : ""}
      <div class="channel-header-info">
        <div class="card-top">
          <h3>${escapeHtml(sn.title || "")}</h3>
          <button type="button" class="btn-fav ${favOn ? "on" : ""}" id="ch-fav" aria-pressed="${favOn}">${favOn ? "★" : "☆"}</button>
        </div>
        <p>${escapeHtml(sn.customUrl || "")} · ${fmtDate(sn.publishedAt)} · ${escapeHtml(sn.country || "—")}</p>
        <p class="muted-desc">${escapeHtml((sn.description || "").slice(0, 240))}${(sn.description || "").length > 240 ? "…" : ""}</p>
        <div class="money-row" style="margin-top:8px;">
          <span class="score ${scoreClass(s.cashScore)}">💰 ${s.cashScore}</span>
          <span class="money-pill">${escapeHtml(verticalLabel(s.vertical))} · ${s.yppLikely ? t("ypp") : t("ypp_no")}${s.affiliate ? " · " + t("affiliate") : ""}</span>
        </div>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Subs</div><div class="stat-value">${fmtNum(s.subs)}</div></div>
      <div class="stat-card"><div class="stat-label">Views</div><div class="stat-value">${fmtNum(s.totalViews)}</div></div>
      <div class="stat-card"><div class="stat-label">${escapeHtml(t("videos"))}</div><div class="stat-value">${fmtNum(s.videoCount)}</div></div>
      <div class="stat-card"><div class="stat-label">${escapeHtml(t("med_views"))}</div><div class="stat-value">${fmtNum(s.medianViews)}</div></div>
      <div class="stat-card"><div class="stat-label">Uploads / sem.</div><div class="stat-value">${s.uploadsPerWeek.toFixed(1)}</div></div>
      <div class="stat-card"><div class="stat-label">Avg 30j</div><div class="stat-value">${fmtNum(s.avgViews30d)}</div><div class="stat-sub">${s.last30Count} vid</div></div>
      <div class="stat-card"><div class="stat-label">Shorts</div><div class="stat-value">${(s.shortsRatio * 100).toFixed(0)}%</div></div>
      <div class="stat-card highlight"><div class="stat-label">${escapeHtml(t("est_adsense_30"))}</div><div class="stat-value">${fmtMoney(s.monetMin)}–${fmtMoney(s.monetMax)}</div><div class="stat-sub">RPM $${s.rpmMin.toFixed(1)}–$${s.rpmMax.toFixed(1)} · ${escapeHtml(verticalLabel(s.vertical))}</div></div>
      <div class="stat-card"><div class="stat-label">${escapeHtml(t("money_eff"))}</div><div class="stat-value">${Math.round(s.moneyEfficiency)}</div><div class="stat-sub">vues / abonné</div></div>
    </div>
    ${recentFiltered.length ? `
      <div class="results-head">
        <div class="section-title" style="margin:0;">Uploads</div>
        ${csvButton(csvRows, `nichescope-channel-${(sn.title || "x").replace(/\W+/g, "_")}.csv`, t("export_csv"))}
      </div>
      <div class="card-grid">
        ${recentFiltered.slice(0, 12).map(v => `
          <article class="card">
            <a class="card-thumb" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">
              ${v.thumb ? `<img loading="lazy" src="${v.thumb}" alt="">` : ""}
            </a>
            <div class="card-title"><a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${escapeHtml(v.title)}</a></div>
            <div class="card-meta"><span>${fmtDate(v.publishedAt)}</span><span>· ${fmtDuration(v.duration)}</span></div>
            <div class="card-stats"><span><b>${fmtNum(v.views)}</b></span><span><b>${fmtNum(v.likes)}</b></span></div>
          </article>
        `).join("")}
      </div>
    ` : ""}
  `;

  $("#ch-fav")?.addEventListener("click", () => {
    toggleFavorite({
      type: "channel",
      id: channel.id,
      title: sn.title,
      meta: { vertical: s.vertical, cashScore: s.cashScore, monthlyMid: (s.monetMin + s.monetMax) / 2 },
    });
    renderPipeline();
    renderChannel(channel, recentFiltered, recentAll, format);
  });
}

function renderChannelCompare(results) {
  results.forEach(r => {
    if (r.channel) r.stats = scoreChannelMoney(r.channel, r.recent);
  });
  const enriched = results.filter(r => r.stats);
  const bestOf = (key) => {
    const vals = enriched.map(r => r.stats[key]).filter(v => !isNaN(v) && v > 0);
    return vals.length ? Math.max(...vals) : null;
  };
  const bestSubs = bestOf("subs");
  const bestAvg30 = bestOf("avgViews30d");
  const bestUpw = bestOf("uploadsPerWeek");
  const bestRPM = bestOf("monetMax");
  const bestCash = bestOf("cashScore");

  const csvRows = enriched.map(r => ({
    channel: r.channel.snippet.title,
    cash_score: r.stats.cashScore,
    vertical: r.stats.vertical,
    subs: r.stats.subs,
    avg_views_30d: Math.round(r.stats.avgViews30d),
    uploads_per_week: r.stats.uploadsPerWeek.toFixed(2),
    est_adsense_min: Math.round(r.stats.monetMin),
    est_adsense_max: Math.round(r.stats.monetMax),
    ypp_likely: r.stats.yppLikely,
  }));

  $("#channel-results").innerHTML = `
    <div class="results-head">
      <p>${escapeHtml(t("compare_lead"))}</p>
      ${enriched.length ? csvButton(csvRows, "nichescope-compare.csv", t("export_csv")) : ""}
    </div>
    <div class="compare-grid">
      ${results.map(r => {
        if (r.error) return `<div class="compare-col"><div class="error">${escapeHtml(r.input)}: ${escapeHtml(r.error)}</div></div>`;
        const sn = r.channel.snippet;
        const st = r.stats;
        const avatar = sn.thumbnails?.default?.url;
        const isBest = (val, best) => best && val === best ? "best" : "";
        return `
          <div class="compare-col">
            <div class="channel-mini">
              ${avatar ? `<img src="${avatar}" alt="">` : ""}
              <div>
                <div class="ch-name">${escapeHtml(sn.title)}</div>
                <div class="ch-handle">${escapeHtml(sn.customUrl || "")}</div>
              </div>
            </div>
            <div class="compare-stats">
              <div class="compare-stat-row"><span class="lbl">${escapeHtml(t("cash_score"))}</span><span class="val ${isBest(st.cashScore, bestCash)}">${st.cashScore}</span></div>
              <div class="compare-stat-row"><span class="lbl">${escapeHtml(t("vertical"))}</span><span class="val">${escapeHtml(verticalLabel(st.vertical))}</span></div>
              <div class="compare-stat-row"><span class="lbl">Subs</span><span class="val ${isBest(st.subs, bestSubs)}">${fmtNum(st.subs)}</span></div>
              <div class="compare-stat-row"><span class="lbl">Avg 30j</span><span class="val ${isBest(st.avgViews30d, bestAvg30)}">${fmtNum(st.avgViews30d)}</span></div>
              <div class="compare-stat-row"><span class="lbl">Uploads / sem.</span><span class="val ${isBest(st.uploadsPerWeek, bestUpw)}">${st.uploadsPerWeek.toFixed(1)}</span></div>
              <div class="compare-stat-row"><span class="lbl">${escapeHtml(t("est_adsense_30"))}</span><span class="val ${isBest(st.monetMax, bestRPM)}">${fmtMoney(st.monetMin)}–${fmtMoney(st.monetMax)}</span></div>
              <div class="compare-stat-row"><span class="lbl">YPP</span><span class="val">${st.yppLikely ? "✓" : "—"}</span></div>
            </div>
          </div>`;
      }).join("")}
    </div>
  `;
}
