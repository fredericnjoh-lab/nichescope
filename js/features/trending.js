import { yt, ytVideos } from "../api.js";
import { $, escapeHtml, fmtNum, fmtDate, fmtDuration, daysSince, hydrateVideos, filterByFormat, csvButton } from "../utils.js";
import { t } from "../i18n.js";
import { addHistory, setLoading, setError, setEmpty } from "../ui.js";

export async function onTrending(e) {
  e.preventDefault();
  const query = $("#trending-query").value.trim();
  const days = parseInt($("#trending-window").value, 10);
  const region = $("#trending-region").value;
  const format = $("#trending-format").value;
  addHistory("trending", `${query || "(all)"} · ${days}d · ${region || "WW"} · ${format}`);
  setLoading("#trending-results");
  try {
    const publishedAfter = new Date(Date.now() - days * 86400000).toISOString();
    let videos = [];

    if (query) {
      const search = await yt("search", {
        part: "snippet",
        q: query,
        type: "video",
        maxResults: 50,
        order: "viewCount",
        publishedAfter,
        regionCode: region || undefined,
        relevanceLanguage: "fr",
      });
      const ids = (search.items || []).map(i => i.id.videoId).filter(Boolean);
      if (!ids.length) return setEmpty("#trending-results", t("no_results"));
      const vd = await ytVideos(ids);
      videos = hydrateVideos(vd.items);
    } else {
      const popular = await yt("videos", {
        part: "snippet,statistics,contentDetails",
        chart: "mostPopular",
        maxResults: 50,
        regionCode: region || "FR",
      });
      videos = hydrateVideos(popular.items);
    }

    videos = filterByFormat(videos, format);
    if (!videos.length) return setEmpty("#trending-results", t("no_results"));
    renderTrending(videos, days, query, region, format);
  } catch (err) {
    setError("#trending-results", err);
  }
}

function renderTrending(videos, days, query, region, format) {
  videos = videos
    .map(v => ({ ...v, vpd: v.views / daysSince(v.publishedAt) }))
    .sort((a, b) => b.vpd - a.vpd);

  const csvRows = videos.map(v => ({
    title: v.title, channel: v.channelTitle, views: v.views,
    views_per_day: Math.round(v.vpd), likes: v.likes,
    duration_sec: v.duration, published: v.publishedAt,
    url: `https://www.youtube.com/watch?v=${v.id}`,
  }));

  $("#trending-results").innerHTML = `
    <div class="results-head">
      <p><b>${videos.length}</b> · ${days}d${region ? ` · ${region}` : ""}${format !== "all" ? ` · ${format}` : ""}</p>
      ${csvButton(csvRows, "nichescope-trending.csv", t("export_csv"))}
    </div>
    <div class="card-grid">
      ${videos.map(v => `
        <article class="card">
          <a class="card-thumb" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">
            ${v.thumb ? `<img loading="lazy" src="${v.thumb}" alt="">` : ""}
          </a>
          <div class="card-title"><a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${escapeHtml(v.title)}</a></div>
          <div class="card-meta">
            <span>${escapeHtml(v.channelTitle)}</span>
            <span>· ${fmtDate(v.publishedAt)}</span>
            <span>· ${fmtDuration(v.duration)}</span>
          </div>
          <div class="card-stats">
            <span><b>${fmtNum(v.views)}</b></span>
            <span><b>${fmtNum(v.vpd)}</b>/j</span>
            <span><b>${fmtNum(v.likes)}</b></span>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}
