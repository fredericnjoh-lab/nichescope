/** Optimize tab — vidIQ-style keyword score, generators, video SEO audit */

import { yt, ytVideos, ytChannels } from "../api.js";
import {
  $, $$, escapeHtml, fmtNum, hydrateVideos, csvButton, downloadCSV,
} from "../utils.js";
import { t, getLang } from "../i18n.js";
import { addHistory, setLoading, setError, setEmpty } from "../ui.js";
import { tokenize, extractTopTerms } from "../clustering.js";
import {
  scoreKeywordOverall,
  scoreVideoSeo,
  extractQuestions,
  generateTags,
  generateTitles,
  generateDescription,
  parseVideoId,
} from "../seo.js";

async function fetchKeywordContext(query) {
  const search = await yt("search", {
    part: "snippet",
    q: query,
    type: "video",
    maxResults: 50,
    order: "relevance",
    relevanceLanguage: getLang() === "en" ? "en" : "fr",
  });
  if (!search.items?.length) return null;

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
  const queryStems = tokenize(query);
  const related = extractTopTerms(videos.map(v => v.title), 16, videos.map(v => v.views))
    .filter(([term]) => !queryStems.every(q => term.includes(q)))
    .slice(0, 14);
  const questions = extractQuestions(videos.map(v => v.title), 8);
  const scores = scoreKeywordOverall({ totalResults, avgTopSubs, avgTopViews, smallChannels });

  return { totalResults, avgTopSubs, avgTopViews, smallChannels, top10, related, questions, scores, videos };
}

function renderOptimizeKeyword(query, ctx) {
  const { scores, related, questions, top10, totalResults, avgTopSubs, avgTopViews, smallChannels } = ctx;
  const tags = generateTags({
    keyword: query,
    related,
    titles: top10.map(v => v.title),
    lang: getLang(),
  });
  const titles = generateTitles({ keyword: query, lang: getLang(), related, count: 6 });
  const desc = generateDescription({ keyword: query, lang: getLang(), title: titles[0]?.title });

  const csvRows = related.map(([term], i) => ({
    rank: i + 1,
    related: term,
    focus: query,
    overall: scores.overall,
  }));

  $("#optimize-results").innerHTML = `
    <div class="results-head">
      <p><b>${escapeHtml(query)}</b> · ${escapeHtml(t("seo_overall"))}</p>
      ${csvButton(csvRows, `nichescope-seo-${query.replace(/\W+/g, "_")}.csv`, t("export_csv"))}
    </div>

    <div class="seo-scoreboard">
      <div class="seo-big">
        <div class="stat-label">${escapeHtml(t("seo_overall"))}</div>
        <div class="seo-big-value score ${scores.overallBracket.cls}">${scores.overall}</div>
        <div class="stat-sub">${escapeHtml(t("seo_overall_hint"))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(t("seo_volume"))}</div>
        <div class="stat-value"><span class="score ${scores.volumeBracket.cls}">${scores.volumeScore}</span></div>
        <div class="stat-sub">${escapeHtml(scores.volumeBracket.label)} · ${escapeHtml(t("seo_volume_proxy"))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(t("seo_competition"))}</div>
        <div class="stat-value"><span class="score ${scores.competitionBracket.cls}">${scores.competitionScore}</span></div>
        <div class="stat-sub">${escapeHtml(scores.competitionBracket.label)} · avg ${fmtNum(avgTopSubs)} subs</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(t("seo_opportunity"))}</div>
        <div class="stat-value">${scores.opportunityScore}</div>
        <div class="stat-sub">${smallChannels}/10 ${escapeHtml(t("seo_small_ch"))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">YT results</div>
        <div class="stat-value">${fmtNum(totalResults)}</div>
        <div class="stat-sub">avg views top10 ${fmtNum(avgTopViews)}</div>
      </div>
    </div>

    <div class="section-title">${escapeHtml(t("seo_related"))}</div>
    <div class="niche-keywords" style="margin-bottom:18px;">
      ${related.map(([term]) =>
        `<button type="button" class="kw-tag seo-related" data-kw="${escapeHtml(term)}">${escapeHtml(term)}</button>`
      ).join("")}
    </div>

    ${questions.length ? `
      <div class="section-title">${escapeHtml(t("seo_questions"))}</div>
      <ul class="seo-questions">
        ${questions.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
      </ul>
    ` : ""}

    <div class="section-title">${escapeHtml(t("seo_titles"))}</div>
    <div class="brief-list">
      ${titles.map(item => `
        <article class="brief-card">
          <div class="card-top">
            <span class="score ${item.seo.bracket.cls}">SEO ${item.seo.score}</span>
          </div>
          <h4>${escapeHtml(item.title)}</h4>
          <button type="button" class="btn-csv use-title" data-title="${escapeHtml(item.title)}">${escapeHtml(t("seo_use_title"))}</button>
        </article>
      `).join("")}
    </div>

    <div class="section-title">${escapeHtml(t("seo_tags"))}</div>
    <div class="seo-tags-box">
      <div class="niche-keywords" id="seo-tags-list">
        ${tags.map(tag => `<span class="kw-tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
      <div class="export-group" style="margin-top:10px;">
        <button type="button" class="btn-csv" id="copy-tags">${escapeHtml(t("seo_copy_tags"))}</button>
        <button type="button" class="btn-csv" id="dl-tags">${escapeHtml(t("export_csv"))}</button>
      </div>
    </div>

    <div class="section-title">${escapeHtml(t("seo_description"))}</div>
    <textarea class="seo-desc" id="seo-desc-out" rows="10" readonly>${escapeHtml(desc)}</textarea>
    <button type="button" class="btn-csv" id="copy-desc" style="margin-top:8px;">${escapeHtml(t("seo_copy_desc"))}</button>
  `;

  $$("#optimize-results .seo-related").forEach(el => {
    el.addEventListener("click", () => {
      $("#optimize-query").value = el.dataset.kw;
      onOptimizeKeyword({ preventDefault() {} });
    });
  });
  $$("#optimize-results .use-title").forEach(btn => {
    btn.addEventListener("click", () => {
      $("#seo-draft-title").value = btn.dataset.title;
      $("#seo-draft-keyword").value = query;
      $("#seo-draft-tags").value = tags.join(", ");
      $("#seo-draft-desc").value = generateDescription({
        keyword: query, lang: getLang(), title: btn.dataset.title,
      });
      onScoreDraft({ preventDefault() {} });
      document.getElementById("seo-draft-block")?.scrollIntoView({ behavior: "smooth" });
    });
  });
  $("#copy-tags")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(tags.join(", "));
      $("#copy-tags").textContent = "✓";
      setTimeout(() => { $("#copy-tags").textContent = t("seo_copy_tags"); }, 1200);
    } catch { /* ignore */ }
  });
  $("#dl-tags")?.addEventListener("click", () => {
    downloadCSV(tags.map((tag, i) => ({ rank: i + 1, tag })), `nichescope-tags-${query.replace(/\W+/g, "_")}.csv`);
  });
  $("#copy-desc")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(desc);
      $("#copy-desc").textContent = "✓";
      setTimeout(() => { $("#copy-desc").textContent = t("seo_copy_desc"); }, 1200);
    } catch { /* ignore */ }
  });
}

export async function onOptimizeKeyword(e) {
  e?.preventDefault?.();
  const query = ($("#optimize-query")?.value || "").trim();
  if (!query) return;
  addHistory("optimize", query);
  setLoading("#optimize-results");
  try {
    const ctx = await fetchKeywordContext(query);
    if (!ctx) return setEmpty("#optimize-results", t("no_results"));
    renderOptimizeKeyword(query, ctx);
  } catch (err) {
    setError("#optimize-results", err);
  }
}

function renderDraftScore(result, meta = {}) {
  const { score, bracket: br, checks } = result;
  $("#seo-draft-score").innerHTML = `
    <div class="seo-scoreboard compact">
      <div class="seo-big">
        <div class="stat-label">${escapeHtml(t("seo_video_score"))}</div>
        <div class="seo-big-value score ${br.cls}">${score}</div>
        <div class="stat-sub">${result.passed}/${result.total} ${escapeHtml(t("seo_checks_pass"))}</div>
      </div>
    </div>
    <ul class="seo-checklist">
      ${checks.map(c => `
        <li class="${c.pass ? "pass" : "fail"}">
          <span class="chk">${c.pass ? "✓" : "○"}</span>
          ${escapeHtml(t("seo_check_" + c.id) !== "seo_check_" + c.id ? t("seo_check_" + c.id) : c.tip)}
          <span class="w">+${c.weight}</span>
        </li>
      `).join("")}
    </ul>
    ${meta.videoTitle ? `<p class="muted" style="font-size:12px;">${escapeHtml(meta.videoTitle)}</p>` : ""}
  `;
}

export function onScoreDraft(e) {
  e?.preventDefault?.();
  const title = $("#seo-draft-title")?.value || "";
  const description = $("#seo-draft-desc")?.value || "";
  const focusKeyword = $("#seo-draft-keyword")?.value || "";
  const tags = ($("#seo-draft-tags")?.value || "")
    .split(/[,;\n]/)
    .map(s => s.trim())
    .filter(Boolean);
  const result = scoreVideoSeo({ title, description, tags, focusKeyword });
  renderDraftScore(result);
}

export async function onAuditVideo(e) {
  e?.preventDefault?.();
  const raw = ($("#seo-video-url")?.value || "").trim();
  const focusKeyword = ($("#seo-video-keyword")?.value || "").trim();
  const id = parseVideoId(raw);
  if (!id) return setEmpty("#seo-video-results", t("seo_bad_url"));

  addHistory("optimize", `video · ${id}`);
  setLoading("#seo-video-results");
  try {
    const vd = await yt("videos", {
      part: "snippet,statistics,contentDetails",
      id,
    });
    const item = vd.items?.[0];
    if (!item) return setEmpty("#seo-video-results", t("err_not_found"));

    const sn = item.snippet || {};
    const title = sn.title || "";
    const description = sn.description || "";
    const tags = sn.tags || [];
    const kw = focusKeyword || tokenize(title).slice(0, 3).join(" ");
    const result = scoreVideoSeo({ title, description, tags, focusKeyword: kw });

    $("#seo-draft-title").value = title;
    $("#seo-draft-desc").value = description;
    $("#seo-draft-tags").value = tags.join(", ");
    $("#seo-draft-keyword").value = kw;

    $("#seo-video-results").innerHTML = `
      <div class="results-head">
        <p><a href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">${escapeHtml(title)}</a></p>
      </div>
      <div class="card-meta" style="margin-bottom:12px;">
        <span>${escapeHtml(sn.channelTitle || "")}</span>
        <span>· ${fmtNum(parseInt(item.statistics?.viewCount || 0, 10))} views</span>
        <span>· ${tags.length} tags</span>
      </div>
    `;
    renderDraftScore(result, { videoTitle: title });
    // Append checklist into video results too
    const scoreBox = $("#seo-draft-score")?.innerHTML || "";
    $("#seo-video-results").insertAdjacentHTML("beforeend", scoreBox);
  } catch (err) {
    setError("#seo-video-results", err);
  }
}

let optimizeWired = false;
export function initOptimize() {
  if (optimizeWired) return;
  optimizeWired = true;
  $("#form-optimize")?.addEventListener("submit", onOptimizeKeyword);
  $("#form-seo-draft")?.addEventListener("submit", onScoreDraft);
  $("#form-seo-video")?.addEventListener("submit", onAuditVideo);
}

