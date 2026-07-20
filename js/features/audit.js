/**
 * Client audit report — self-contained printable HTML (Save as PDF).
 * Pulls pipeline + last Studio scan/plan, or runs a focused fetch from the audit form.
 */

import { resolveChannel, fetchRecentVideos } from "../api.js";
import {
  $, escapeHtml, fmtNum, fmtMoney, median, filterByFormat, downloadJSON,
} from "../utils.js";
import { t, verticalLabel, getLang } from "../i18n.js";
import { setLoading, setError, setEmpty, addHistory } from "../ui.js";
import { getFavorites } from "../favorites.js";
import { discoverNiches } from "./discover.js";
import { scoreChannelMoney } from "../money.js";
import { buildStudioPlan } from "../editorial.js";
import { getStudioSnapshot, getLastPlan } from "../session.js";

const DISCLAIMER_FR =
  "Estimations AdSense / RPM basées sur des benchmarks industrie et des proxies YouTube Data API. Ce ne sont pas des revenus réels. À utiliser comme aide à la décision, pas comme garantie financière.";
const DISCLAIMER_EN =
  "AdSense / RPM figures are industry benchmarks and YouTube Data API proxies — not actual revenue. Decision support only, not a financial guarantee.";

async function scorePipelineChannels(limit = 3) {
  const channels = getFavorites().filter(f => f.type === "channel").slice(0, limit);
  const scored = [];
  for (const fav of channels) {
    try {
      let channel = null;
      for (const c of [fav.id, fav.meta?.handle, fav.title].filter(Boolean)) {
        channel = await resolveChannel(c);
        if (channel) break;
      }
      if (!channel) continue;
      const recent = await fetchRecentVideos(channel, 50);
      const money = scoreChannelMoney(channel, recent);
      const long = filterByFormat(recent, "long");
      const pool = long.length >= 8 ? long : recent;
      const med = median(pool.map(v => v.views));
      const outliers = med
        ? pool
          .map(v => ({ ...v, multiplier: v.views / med }))
          .filter(v => v.multiplier >= 2.5)
          .sort((a, b) => b.multiplier - a.multiplier)
          .slice(0, 5)
        : [];
      scored.push({
        title: channel.snippet?.title || fav.title,
        handle: channel.snippet?.customUrl || "",
        money,
        outliers,
      });
    } catch { /* skip */ }
  }
  return scored;
}

async function gatherAuditPayload({ clientName, nicheQuery, channelRaw, region }) {
  const lang = getLang();
  const snap = getStudioSnapshot();
  const nichesFav = getFavorites().filter(f => f.type === "niche");
  let clusters = snap.clusters || [];
  let topic = nicheQuery || snap.topic || nichesFav[0]?.title || "";
  let channelProfiles = [];

  // Focused niche scan if form has a query and we lack clusters
  if (nicheQuery && (!clusters.length || nicheQuery !== snap.topic)) {
    const { clusters: found } = await discoverNiches(nicheQuery, region, lang);
    clusters = found.sort((a, b) => b.cashScore - a.cashScore).slice(0, 8);
    topic = nicheQuery;
  } else {
    clusters = [...clusters].sort((a, b) => b.cashScore - a.cashScore).slice(0, 8);
  }

  // Explicit channel(s) from form
  if (channelRaw) {
    const inputs = channelRaw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 2);
    for (const input of inputs) {
      const channel = await resolveChannel(input);
      if (!channel) continue;
      const recent = await fetchRecentVideos(channel, 50);
      const money = scoreChannelMoney(channel, recent);
      const long = filterByFormat(recent, "long");
      const pool = long.length >= 8 ? long : recent;
      const med = median(pool.map(v => v.views));
      const outliers = med
        ? pool
          .map(v => ({ ...v, multiplier: v.views / med }))
          .filter(v => v.multiplier >= 2.5)
          .sort((a, b) => b.multiplier - a.multiplier)
          .slice(0, 5)
        : [];
      channelProfiles.push({
        title: channel.snippet?.title || input,
        handle: channel.snippet?.customUrl || input,
        money,
        outliers,
      });
    }
  }

  if (!channelProfiles.length) {
    channelProfiles = await scorePipelineChannels(3);
  }

  const outliers = channelProfiles.flatMap(c =>
    (c.outliers || []).map(o => ({ ...o, channelTitle: c.title }))
  );
  let plan = getLastPlan();
  if (!plan || !plan.briefs?.length) {
    plan = buildStudioPlan({
      outliers,
      niches: nichesFav.length ? nichesFav : clusters.slice(0, 5).map(c => ({ title: c.term })),
      topic,
      lang,
      perWeek: 3,
      weeks: 2,
      titleCount: 8,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    clientName: clientName || (lang === "en" ? "Prospect" : "Prospect"),
    topic: topic || (lang === "en" ? "YouTube niche" : "Niche YouTube"),
    region: region || "",
    lang,
    clusters,
    channelProfiles,
    plan,
    pipeline: getFavorites(),
    disclaimer: lang === "en" ? DISCLAIMER_EN : DISCLAIMER_FR,
  };
}

function reportStyles() {
  return `
    :root { --bg:#0a0c10; --surface:#12151c; --border:#2a3040; --text:#eef1f6; --muted:#8b93a7; --accent:#e11d37; --cash:#4ade80; --warn:#e8a317; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: "DM Sans", "Segoe UI", sans-serif; background:#fff; color:#12161e; line-height:1.45; }
    .sheet { max-width:900px; margin:0 auto; padding:32px 28px 48px; }
    .cover { border-bottom:3px solid var(--accent); padding-bottom:20px; margin-bottom:28px; }
    .kicker { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); font-weight:700; margin:0 0 8px; }
    h1 { font-family: Georgia, "Instrument Serif", serif; font-size:34px; font-weight:400; margin:0 0 8px; letter-spacing:-.02em; }
    .meta { color:#5c6478; font-size:13px; }
    h2 { font-size:18px; margin:28px 0 12px; border-left:3px solid var(--cash); padding-left:10px; }
    h3 { font-size:14px; margin:0 0 6px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; }
    .card { border:1px solid #d5dae6; border-radius:10px; padding:12px 14px; background:#f8f9fc; }
    .card .lbl { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#5c6478; }
    .card .val { font-size:20px; font-weight:700; margin-top:4px; }
    .card .sub { font-size:11px; color:#5c6478; margin-top:2px; }
    table { width:100%; border-collapse:collapse; font-size:12px; margin-top:8px; }
    th, td { text-align:left; padding:8px 6px; border-bottom:1px solid #e2e6ef; vertical-align:top; }
    th { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#5c6478; }
    .pill { display:inline-block; background:#e8faf0; color:#15803d; padding:2px 8px; border-radius:99px; font-size:11px; font-weight:600; }
    .pill.warn { background:#fff7e6; color:#b45309; }
    .list { margin:0; padding-left:18px; font-size:13px; }
    .list li { margin-bottom:6px; }
    .thumb { font-size:11px; color:#5c6478; margin-top:2px; }
    .disclaimer { margin-top:32px; padding:12px 14px; background:#fff5f5; border:1px solid #fecaca; border-radius:8px; font-size:11px; color:#7f1d1d; }
    .actions { position:sticky; top:0; background:rgba(255,255,255,.95); border-bottom:1px solid #e2e6ef; padding:10px 28px; display:flex; gap:8px; z-index:5; }
    .actions button { font-family:inherit; cursor:pointer; border-radius:8px; padding:8px 14px; font-size:13px; font-weight:600; border:1px solid #d5dae6; background:#fff; }
    .actions .primary { background:var(--accent); color:#fff; border-color:var(--accent); }
    footer { margin-top:24px; font-size:11px; color:#8b93a7; }
    @media print {
      .actions { display:none !important; }
      .sheet { padding:12px 0; max-width:100%; }
      body { background:#fff; }
      .card, .disclaimer { break-inside: avoid; }
    }
  `;
}

function buildReportHtml(data) {
  const L = data.lang === "en";
  const dateStr = new Date(data.generatedAt).toLocaleDateString(L ? "en-GB" : "fr-FR", {
    year: "numeric", month: "long", day: "numeric",
  });
  const topNiches = (data.clusters || []).slice(0, 6);
  const channels = data.channelProfiles || [];
  const slots = data.plan?.calendar?.slots?.slice(0, 8) || [];
  const briefs = data.plan?.briefs?.slice(0, 6) || [];
  const patterns = data.plan?.analysis?.rankedPatterns?.slice(0, 5) || [];

  const nicheRows = topNiches.map(c => `
    <tr>
      <td><b>${escapeHtml(c.term)}</b></td>
      <td><span class="pill">${c.cashScore}</span></td>
      <td>${escapeHtml(verticalLabel(c.vertical))}</td>
      <td>${fmtMoney(c.monthlyMin)}–${fmtMoney(c.monthlyMax)}</td>
      <td>${fmtNum(c.medViews)}</td>
      <td>${fmtNum(c.avgSubs)}</td>
    </tr>`).join("");

  const channelBlocks = channels.map(ch => {
    const m = ch.money;
    const outs = (ch.outliers || []).slice(0, 3).map(o =>
      `<li><b>${o.multiplier.toFixed(1)}×</b> — ${escapeHtml(o.title)} (${fmtNum(o.views)})</li>`
    ).join("");
    return `
      <div class="card" style="margin-bottom:10px;">
        <h3>${escapeHtml(ch.title)} <span class="meta">${escapeHtml(ch.handle || "")}</span></h3>
        <div class="grid" style="margin-top:8px;">
          <div><div class="lbl">Cash Score</div><div class="val">${m.cashScore}</div></div>
          <div><div class="lbl">${L ? "Est. AdSense 30d" : "Est. AdSense 30j"}</div><div class="val">${fmtMoney(m.monetMin)}–${fmtMoney(m.monetMax)}</div></div>
          <div><div class="lbl">Subs</div><div class="val">${fmtNum(m.subs)}</div></div>
          <div><div class="lbl">${L ? "Vertical" : "Verticale"}</div><div class="val" style="font-size:14px;">${escapeHtml(verticalLabel(m.vertical))}</div></div>
        </div>
        ${outs ? `<p class="lbl" style="margin-top:10px;">Outliers</p><ul class="list">${outs}</ul>` : ""}
      </div>`;
  }).join("");

  const calRows = slots.map(s => `
    <tr>
      <td>S${s.week}</td>
      <td>${escapeHtml(s.date)}</td>
      <td>${s.format === "shorts" ? "Shorts" : "Long"}</td>
      <td><b>${escapeHtml(s.title)}</b>
        ${s.thumb ? `<div class="thumb">Thumb: “${escapeHtml(s.thumb.overlayText)}” · ${escapeHtml(s.thumb.emotion)}</div>` : ""}
      </td>
    </tr>`).join("");

  const briefItems = briefs.map(b => `
    <li>
      <b>${escapeHtml(b.title)}</b>
      <div class="thumb">${escapeHtml(b.pattern)} · overlay “${escapeHtml(b.thumb?.overlayText || "")}” · ${escapeHtml(b.thumb?.composition || "")}</div>
    </li>`).join("");

  const nextSteps = L
    ? [
        "Pick the #1 cash niche from the table and commit 4 weeks.",
        "Clone structure (not copy) of the top 2 outlier titles.",
        "Ship the calendar slots below; review CTR week 2.",
        "Optional: retainer for weekly outlier refresh + scripts.",
      ]
    : [
        "Choisir la niche #1 cash du tableau et s’engager 4 semaines.",
        "Cloner la structure (pas le contenu) des 2 meilleurs titres outliers.",
        "Publier les créneaux du calendrier ; revoir le CTR en semaine 2.",
        "Option : retainer pour refresh outliers + scripts chaque semaine.",
      ];

  return `<!doctype html>
<html lang="${data.lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NicheScope Audit — ${escapeHtml(data.clientName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Instrument+Serif&display=swap" rel="stylesheet" />
  <style>${reportStyles()}</style>
</head>
<body>
  <div class="actions">
    <button type="button" class="primary" onclick="window.print()">${L ? "Print / Save PDF" : "Imprimer / Sauver PDF"}</button>
    <button type="button" onclick="window.close()">${L ? "Close" : "Fermer"}</button>
  </div>
  <div class="sheet">
    <header class="cover">
      <p class="kicker">NicheScope Studio · ${L ? "YouTube Monetization Audit" : "Audit monétisation YouTube"}</p>
      <h1>${escapeHtml(data.clientName)}</h1>
      <p class="meta">
        ${L ? "Focus" : "Focus"}: <b>${escapeHtml(data.topic)}</b>
        ${data.region ? ` · ${escapeHtml(data.region)}` : ""}
        · ${escapeHtml(dateStr)}
      </p>
    </header>

    <h2>1. ${L ? "Executive summary" : "Synthèse"}</h2>
    <div class="grid">
      <div class="card">
        <div class="lbl">${L ? "Cash niches found" : "Niches cash trouvées"}</div>
        <div class="val">${topNiches.length}</div>
        <div class="sub">${topNiches[0] ? `Top: ${escapeHtml(topNiches[0].term)} (${topNiches[0].cashScore})` : "—"}</div>
      </div>
      <div class="card">
        <div class="lbl">${L ? "Channels audited" : "Chaînes auditées"}</div>
        <div class="val">${channels.length}</div>
        <div class="sub">${channels[0] ? escapeHtml(channels[0].title) : "—"}</div>
      </div>
      <div class="card">
        <div class="lbl">${L ? "Plan slots" : "Créneaux plan"}</div>
        <div class="val">${slots.length}</div>
        <div class="sub">${patterns.map(p => p.id).join(" · ") || "—"}</div>
      </div>
      <div class="card">
        <div class="lbl">${L ? "Best est. monthly (niche)" : "Meilleur est. / mois (niche)"}</div>
        <div class="val">${topNiches[0] ? fmtMoney(topNiches[0].monthlyMid) : "—"}</div>
        <div class="sub">RPM proxy · ${topNiches[0] ? escapeHtml(verticalLabel(topNiches[0].vertical)) : ""}</div>
      </div>
    </div>

    <h2>2. ${L ? "Cash niches" : "Niches qui monétisent"}</h2>
    ${topNiches.length ? `
      <table>
        <thead>
          <tr>
            <th>${L ? "Sub-niche" : "Sous-niche"}</th>
            <th>Cash</th>
            <th>${L ? "Vertical" : "Verticale"}</th>
            <th>${L ? "Est. / mo" : "Est. / mois"}</th>
            <th>${L ? "Med. views" : "Vues méd."}</th>
            <th>${L ? "Avg subs" : "Abonnés moy."}</th>
          </tr>
        </thead>
        <tbody>${nicheRows}</tbody>
      </table>` : `<p class="meta">${L ? "No niche scan in session — run Studio Cash first or enter a niche above." : "Pas de scan niche en session — lance Studio Cash ou saisis une niche."}</p>`}

    <h2>3. ${L ? "Channel money profile" : "Profil monétaire des chaînes"}</h2>
    ${channelBlocks || `<p class="meta">${L ? "Add channels to the pipeline ★ or paste a handle in the audit form." : "Ajoute des chaînes ★ au pipeline ou colle un handle dans le formulaire d’audit."}</p>`}

    <h2>4. ${L ? "Editorial plan (2 weeks sample)" : "Plan éditorial (échantillon 2 sem.)"}</h2>
    ${calRows ? `
      <table>
        <thead><tr><th>${L ? "Week" : "Sem."}</th><th>Date</th><th>Format</th><th>${L ? "Title + thumb" : "Titre + thumb"}</th></tr></thead>
        <tbody>${calRows}</tbody>
      </table>` : ""}

    <h2>5. ${L ? "Title & thumbnail briefs" : "Briefs titres & thumbnails"}</h2>
    <ul class="list">${briefItems || `<li>—</li>`}</ul>

    <h2>6. ${L ? "Recommended next steps" : "Prochaines étapes"}</h2>
    <ul class="list">${nextSteps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>

    <div class="disclaimer">${escapeHtml(data.disclaimer)}</div>
    <footer>NicheScope Studio · nichescope · ${escapeHtml(data.generatedAt)}</footer>
  </div>
</body>
</html>`;
}

function openReport(data) {
  const html = buildReportHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener");
  if (!w) {
    // popup blocked → download instead
    const a = document.createElement("a");
    a.href = url;
    a.download = `nichescope-audit-${(data.clientName || "prospect").replace(/\W+/g, "_")}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  try {
    sessionStorage.setItem("nschost:lastAudit", JSON.stringify(data));
  } catch { /* ignore */ }
}

export async function onGenerateAudit(e) {
  e?.preventDefault?.();
  const clientName = ($("#audit-client")?.value || "").trim();
  const nicheQuery = ($("#audit-niche")?.value || $("#studio-query")?.value || "").trim();
  const channelRaw = ($("#audit-channel")?.value || "").trim();
  const region = $("#audit-region")?.value || $("#studio-region")?.value || "";

  const hasPipeline = getFavorites().length > 0;
  const hasSnap = (getStudioSnapshot().clusters || []).length > 0;
  if (!nicheQuery && !channelRaw && !hasPipeline && !hasSnap) {
    return setEmpty("#audit-results", t("audit_need_input"));
  }

  addHistory("studio", `audit · ${clientName || nicheQuery || "prospect"}`);
  setLoading("#audit-results");
  try {
    const data = await gatherAuditPayload({ clientName, nicheQuery, channelRaw, region });
    openReport(data);
    $("#audit-results").innerHTML = `
      <div class="results-head">
        <p>${escapeHtml(t("audit_ready"))} — <b>${escapeHtml(data.clientName)}</b> · ${escapeHtml(data.topic)}</p>
        <div class="export-group">
          <button type="button" class="btn-csv" id="audit-reopen">${escapeHtml(t("audit_reopen"))}</button>
          <button type="button" class="btn-csv" id="audit-json">${escapeHtml(t("export_json"))}</button>
        </div>
      </div>
      <p class="muted" style="font-size:12px;">${escapeHtml(t("audit_print_hint"))}</p>
      <p class="disclaimer-inline">${escapeHtml(data.disclaimer)}</p>
    `;
    $("#audit-reopen")?.addEventListener("click", () => openReport(data));
    $("#audit-json")?.addEventListener("click", () =>
      downloadJSON(data, `nichescope-audit-${data.clientName.replace(/\W+/g, "_")}.json`)
    );
  } catch (err) {
    setError("#audit-results", err);
  }
}

let auditWired = false;
export function initAudit() {
  if (auditWired) return;
  auditWired = true;
  $("#form-audit")?.addEventListener("submit", onGenerateAudit);
}
