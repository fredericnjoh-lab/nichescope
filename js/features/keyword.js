import { yt, ytVideos, ytChannels } from "../api.js";
import { $, $$, escapeHtml, fmtNum, fmtDate, fmtMoney, hydrateVideos, parseISODuration, csvButton, scoreClass } from "../utils.js";
import { t, verticalLabel, getLang } from "../i18n.js";
import { addHistory, setLoading, setError, setEmpty } from "../ui.js";
import { tokenize, extractTopTerms } from "../clustering.js";
import { scoreCashNiche } from "../money.js";
import { scoreKeywordOverall } from "../seo.js";

export async function onKeyword(e) {
  e.preventDefault();
  const query = $("#keyword-query").value.trim();
  if (!query) return;
  addHistory("keyword", query);
  setLoading("#keyword-results");
  try {
    const search = await yt("search", {
      part: "snippet",
      q: query,
      type: "video",
      maxResults: 50,
      order: "relevance",
      relevanceLanguage: getLang() === "en" ? "en" : "fr",
    });
    if (!search.items?.length) return setEmpty("#keyword-results", t("no_results"));

    const totalResults = search.pageInfo?.totalResults || 0;
    const videoIds = search.items.map(i => i.id.videoId).filter(Boolean);
    const channelIds = [...new Set(search.items.map(i => i.snippet.channelId))];

    const [videoData, channelData] = await Promise.all([
      ytVideos(videoIds),
      ytChannels(channelIds),
    ]);

    const channelMap = new Map((channelData.items || []).map(c => [c.id, c]));
    const videos = hydrateVideos(videoData.items).map(v => ({
      ...v,
      channelSubs: parseInt(channelMap.get(v.channelId)?.statistics?.subscriberCount || 0, 10),
    }));

    const top10 = videos.slice(0, 10);
    const avgTopSubs = top10.reduce((s, v) => s + v.channelSubs, 0) / Math.max(1, top10.length);
    const avgTopViews = top10.reduce((s, v) => s + v.views, 0) / Math.max(1, top10.length);
    const smallChannels = top10.filter(v => v.channelSubs < 100000).length;
    const medViews = avgTopViews;

    let difficulty, diffClass;
    if (avgTopSubs > 5e6) { difficulty = "Very Hard"; diffClass = "low"; }
    else if (avgTopSubs > 1e6) { difficulty = "Hard"; diffClass = "low"; }
    else if (avgTopSubs > 100000) { difficulty = "Medium"; diffClass = "med"; }
    else if (avgTopSubs > 10000) { difficulty = "Easy"; diffClass = "high"; }
    else { difficulty = "Very Easy"; diffClass = "high"; }

    const money = scoreCashNiche({
      medViews,
      avgSubs: avgTopSubs,
      avgVPD: top10.reduce((s, v) => s + v.views / Math.max(1, (Date.now() - new Date(v.publishedAt)) / 86400000), 0) / Math.max(1, top10.length),
      count: top10.length,
      titles: top10.map(v => v.title),
    });
    const kwScore = scoreKeywordOverall({ totalResults, avgTopSubs, avgTopViews, smallChannels });

    const queryStems = tokenize(query);
    const related = extractTopTerms(videos.map(v => v.title), 16, videos.map(v => v.views))
      .filter(([term]) => !queryStems.every(q => term.includes(q)))
      .slice(0, 12);

    renderKeyword(query, {
      totalResults, avgTopSubs, avgTopViews, smallChannels, difficulty, diffClass, money, kwScore,
    }, top10, related);
  } catch (err) {
    setError("#keyword-results", err);
  }
}

function renderKeyword(query, summary, top10, related) {
  const csvRows = top10.map((v, i) => ({
    rank: i + 1, title: v.title, channel: v.channelTitle,
    channel_subs: v.channelSubs, views: v.views, duration_sec: v.duration,
    published: v.publishedAt, url: `https://www.youtube.com/watch?v=${v.id}`,
  }));
  const m = summary.money;
  const ks = summary.kwScore;

  $("#keyword-results").innerHTML = `
    <div class="results-head">
      <p><b>${escapeHtml(query)}</b></p>
      ${csvButton(csvRows, `nichescope-keyword-${query.replace(/\W+/g, "_")}.csv`, t("export_csv"))}
    </div>
    <div class="kw-summary">
      ${ks ? `<div class="stat-card highlight"><div class="stat-label">${escapeHtml(t("seo_overall"))}</div><div class="stat-value"><span class="score ${ks.overallBracket.cls}">${ks.overall}</span></div><div class="stat-sub">vol ${ks.volumeScore} · comp ${ks.competitionScore}</div></div>` : ""}
      <div class="stat-card"><div class="stat-label">${escapeHtml(t("difficulty"))}</div><div class="stat-value"><span class="score ${summary.diffClass}">${summary.difficulty}</span></div></div>
      <div class="stat-card highlight"><div class="stat-label">${escapeHtml(t("cash_score"))}</div><div class="stat-value"><span class="score ${scoreClass(m.cashScore)}">💰 ${m.cashScore}</span></div><div class="stat-sub">${escapeHtml(verticalLabel(m.vertical))} · ${fmtMoney(m.monthlyMin)}–${fmtMoney(m.monthlyMax)}/mo</div></div>
      <div class="stat-card"><div class="stat-label">YT results</div><div class="stat-value">${fmtNum(summary.totalResults)}</div></div>
      <div class="stat-card"><div class="stat-label">Avg views top10</div><div class="stat-value">${fmtNum(summary.avgTopViews)}</div></div>
      <div class="stat-card"><div class="stat-label">Avg subs top10</div><div class="stat-value">${fmtNum(summary.avgTopSubs)}</div></div>
      <div class="stat-card"><div class="stat-label">Small ch. top10</div><div class="stat-value">${summary.smallChannels} / 10</div></div>
    </div>
    ${related.length ? `
      <div class="section-title">${escapeHtml(t("related_kw"))}</div>
      <div class="niche-keywords" style="margin-bottom:18px;">
        ${related.map(([term]) => `<button type="button" class="kw-tag" data-kw="${escapeHtml(term)}">${escapeHtml(term)}</button>`).join("")}
      </div>
    ` : ""}
    <div class="section-title">Top 10</div>
    <div class="card-grid">
      ${top10.map((v, i) => `
        <article class="card">
          <a class="card-thumb" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">
            ${v.thumb ? `<img loading="lazy" src="${v.thumb}" alt="">` : ""}
          </a>
          <div class="card-title">#${i + 1} <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${escapeHtml(v.title)}</a></div>
          <div class="card-meta"><span>${escapeHtml(v.channelTitle)}</span><span>· ${fmtNum(v.channelSubs)}</span></div>
          <div class="card-stats"><span><b>${fmtNum(v.views)}</b></span><span>${fmtDate(v.publishedAt)}</span></div>
        </article>
      `).join("")}
    </div>
  `;

  $$("#keyword-results .kw-tag").forEach(el => {
    el.addEventListener("click", () => {
      $("#keyword-query").value = el.dataset.kw;
      $("#form-keyword").requestSubmit();
    });
  });
  void parseISODuration;
}
