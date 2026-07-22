/** Daily Ideas + Topic Tracker tab */

import { yt, ytVideos } from "../api.js";
import {
  $, $$, escapeHtml, fmtNum, hydrateVideos, filterByFormat, csvButton, scoreClass,
} from "../utils.js";
import { t, getLang } from "../i18n.js";
import { addHistory, setLoading, setError, setEmpty } from "../ui.js";
import { getFavorites } from "../favorites.js";
import {
  buildDailyIdeas,
  ideaToRow,
  getTrackedTopics,
  trackTopic,
  untrackTopic,
  isTopicTracked,
  cycleTopicStatus,
  syncTrackerScores,
} from "../ideas.js";

function statusLabel(status) {
  return t(`ideas_status_${status}`) || status;
}

function renderTracker() {
  const items = getTrackedTopics();
  const el = $("#ideas-tracker");
  if (!el) return;

  if (!items.length) {
    el.innerHTML = `<p class="muted">${escapeHtml(t("ideas_tracker_empty"))}</p>`;
    return;
  }

  el.innerHTML = `
    <div class="results-head">
      <p><b>${items.length}</b> · ${escapeHtml(t("ideas_tracker_h3"))}</p>
    </div>
    <div class="ideas-tracker-list">
      ${items.map(item => `
        <div class="ideas-track-row" data-id="${escapeHtml(item.id)}">
          <div class="ideas-track-main">
            <span class="score ${scoreClass(item.score)}">${item.score}</span>
            <div>
              <div class="ch-name">${escapeHtml(item.topic)}</div>
              <div class="muted" style="font-size:12px;">
                ${escapeHtml(item.format)} · ${item.seed ? escapeHtml(item.seed) : "—"}
              </div>
            </div>
          </div>
          <div class="ideas-track-actions">
            <button type="button" class="btn-csv ideas-status" data-id="${escapeHtml(item.id)}" title="${escapeHtml(t("ideas_cycle_status"))}">
              ${escapeHtml(statusLabel(item.status))}
            </button>
            <button type="button" class="btn-csv ideas-untrack" data-id="${escapeHtml(item.id)}">✕</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  $$("#ideas-tracker .ideas-status").forEach(btn => {
    btn.addEventListener("click", () => {
      cycleTopicStatus(btn.dataset.id);
      renderTracker();
    });
  });
  $$("#ideas-tracker .ideas-untrack").forEach(btn => {
    btn.addEventListener("click", () => {
      untrackTopic(btn.dataset.id);
      renderTracker();
      // refresh track buttons in results if present
      $$("#ideas-results .ideas-track-btn").forEach(b => {
        if (b.dataset.id === btn.dataset.id) {
          b.textContent = "★";
          b.classList.remove("on");
        }
      });
    });
  });
}

function renderIdeas(pack) {
  const { ideas, seed, poolSize } = pack;
  syncTrackerScores(ideas);

  if (!ideas.length) {
    return setEmpty("#ideas-results", t("ideas_no_clusters"));
  }

  const rows = ideas.map(ideaToRow);

  $("#ideas-results").innerHTML = `
    <div class="results-head">
      <p><b>${ideas.length}</b> ${escapeHtml(t("ideas_found"))}${seed ? ` · “${escapeHtml(seed)}”` : ""} · ${poolSize} ${escapeHtml(t("ideas_videos_scanned"))}</p>
      ${csvButton(rows, "nichescope-daily-ideas.csv", t("export_csv"))}
    </div>
    <div class="ideas-grid">
      ${ideas.map(idea => {
        const tracked = isTopicTracked(idea.id);
        return `
          <article class="card idea-card" data-id="${escapeHtml(idea.id)}">
            <div class="card-top">
              <div class="card-title">${escapeHtml(idea.topic)}</div>
              <div class="card-top-right">
                <span class="score ${scoreClass(idea.score)}">${idea.score}</span>
                <button type="button" class="btn-fav ideas-track-btn ${tracked ? "on" : ""}"
                  data-id="${escapeHtml(idea.id)}"
                  title="${escapeHtml(t("ideas_track"))}">${tracked ? "★" : "☆"}</button>
              </div>
            </div>
            <div class="card-meta">
              <span><b>${fmtNum(idea.avgVpd)}</b>/j</span>
              <span>· ${idea.videoCount} ${escapeHtml(t("ideas_vids"))}</span>
              <span>· ${idea.channelCount} ch</span>
              <span>· ${escapeHtml(idea.format)}</span>
            </div>
            <ul class="seo-questions ideas-angles">
              ${(idea.angles || []).slice(0, 2).map(a => `<li>${escapeHtml(a)}</li>`).join("")}
            </ul>
            <div class="ideas-evidence muted" style="font-size:12px;">
              ${(idea.evidence || []).slice(0, 2).map(e => `
                <div>
                  <a href="https://www.youtube.com/watch?v=${e.id}" target="_blank" rel="noopener">${escapeHtml(e.title)}</a>
                  · ${fmtNum(e.vpd)}/j
                </div>
              `).join("")}
            </div>
          </article>
        `;
      }).join("")}
    </div>
    <p class="muted" style="font-size:12px;margin-top:12px;">${escapeHtml(t("ideas_disclaimer"))}</p>
  `;

  $$("#ideas-results .ideas-track-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idea = ideas.find(i => i.id === btn.dataset.id);
      if (!idea) return;
      if (isTopicTracked(idea.id)) {
        untrackTopic(idea.id);
        btn.textContent = "☆";
        btn.classList.remove("on");
      } else {
        trackTopic(idea, "idea");
        btn.textContent = "★";
        btn.classList.add("on");
      }
      renderTracker();
    });
  });

  renderTracker();
}

async function fetchIdeaPool(query, region, days, format) {
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
      relevanceLanguage: getLang() === "en" ? "en" : "fr",
    });
    const ids = (search.items || []).map(i => i.id.videoId).filter(Boolean);
    if (!ids.length) return [];
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

  return filterByFormat(videos, format);
}

export async function onIdeas(e) {
  e?.preventDefault?.();
  const query = ($("#ideas-query")?.value || "").trim();
  const days = parseInt($("#ideas-window")?.value || "14", 10);
  const region = $("#ideas-region")?.value || "";
  const format = $("#ideas-format")?.value || "all";

  addHistory("ideas", `${query || "(pipeline/popular)"} · ${days}d`);
  setLoading("#ideas-results");

  try {
    let seed = query;
    let videos = [];

    if (query) {
      videos = await fetchIdeaPool(query, region, days, format);
    } else {
      // Pipeline niches first, else mostPopular
      const niches = getFavorites().filter(f => f.type === "niche").slice(0, 3);
      if (niches.length) {
        seed = niches.map(n => n.title).join(" · ");
        const pools = await Promise.all(
          niches.map(n => fetchIdeaPool(n.title, region, days, format))
        );
        const byId = new Map();
        pools.flat().forEach(v => { if (v?.id) byId.set(v.id, v); });
        videos = [...byId.values()];
      } else {
        videos = await fetchIdeaPool("", region, days, format);
        seed = region || "popular";
      }
    }

    if (!videos.length) return setEmpty("#ideas-results", t("no_results"));

    const pack = buildDailyIdeas({
      videos,
      seed,
      lang: getLang(),
      limit: 12,
    });
    renderIdeas(pack);
  } catch (err) {
    setError("#ideas-results", err);
  }
}

export function fillIdeasFromPipeline() {
  const niches = getFavorites().filter(f => f.type === "niche").slice(0, 3);
  if (!niches.length) {
    alert(t("ideas_pipeline_empty"));
    return;
  }
  $("#ideas-query").value = niches[0].title;
}

let wired = false;
export function initIdeas() {
  if (wired) return;
  wired = true;
  $("#form-ideas")?.addEventListener("submit", onIdeas);
  $("#ideas-from-pipeline")?.addEventListener("click", fillIdeasFromPipeline);
  renderTracker();
}
