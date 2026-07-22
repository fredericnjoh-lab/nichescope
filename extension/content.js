(function () {
  const PANEL_ID = "nschost-seo-panel";
  let lastKey = "";
  let timer = null;

  function textOf(sel) {
    const el = document.querySelector(sel);
    return (el?.textContent || el?.value || "").trim();
  }

  function extractWatch() {
    const title =
      textOf("h1.ytd-watch-metadata yt-formatted-string") ||
      textOf("h1 yt-formatted-string") ||
      document.title.replace(/ - YouTube$/, "").trim();

    // Expand description if collapsed
    const more = document.querySelector("#expand, tp-yt-paper-button#expand");
    if (more) {
      try { more.click(); } catch { /* ignore */ }
    }

    const description =
      textOf("#description-inline-expander") ||
      textOf("#description-text") ||
      textOf("ytd-text-inline-expander") ||
      "";

    return { title, description, tags: [], page: "watch" };
  }

  function extractStudio() {
    const title =
      document.querySelector("#textbox")?.textContent?.trim() ||
      document.querySelector('input[aria-label*="title" i], textarea[aria-label*="title" i]')?.value ||
      "";
    const description =
      document.querySelector("#description-textarea #textbox")?.textContent?.trim() ||
      document.querySelector('textarea[aria-label*="description" i]')?.value ||
      "";
    const tagsRaw =
      document.querySelector('input[aria-label*="tag" i]')?.value ||
      "";
    const tags = tagsRaw
      ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    return { title, description, tags, page: "studio" };
  }

  function extractMeta() {
    const host = location.hostname;
    if (host.includes("studio.youtube.com")) return extractStudio();
    if (location.pathname.startsWith("/watch")) return extractWatch();
    return null;
  }

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="ns-head">
        <strong>NicheScope</strong>
        <button type="button" class="ns-close" aria-label="Close">×</button>
      </div>
      <div class="ns-body">Chargement…</div>
      <div class="ns-foot">
        <a href="https://fredericnjoh-lab.github.io/nichescope/app.html" target="_blank" rel="noopener">Ouvrir l’app</a>
      </div>
    `;
    panel.querySelector(".ns-close").addEventListener("click", () => {
      panel.remove();
    });
    document.documentElement.appendChild(panel);
    return panel;
  }

  function render(meta, focusKeyword) {
    const panel = ensurePanel();
    const result = globalThis.NicheScopeSeo.scoreVideoSeo({
      title: meta.title,
      description: meta.description,
      tags: meta.tags,
      focusKeyword,
    });

    const checks = result.checks
      .map(
        (c) =>
          `<li class="${c.pass ? "pass" : "fail"}"><span>${c.pass ? "✓" : "○"}</span> ${escapeHtml(c.tip)}</li>`,
      )
      .join("");

    panel.querySelector(".ns-body").innerHTML = `
      <div class="ns-score ns-${result.bracket.cls}">${result.score}</div>
      <div class="ns-meta">${escapeHtml(meta.page)} · ${result.passed}/${result.total} checks
        ${focusKeyword ? ` · <em>${escapeHtml(focusKeyword)}</em>` : " · <em>pas de mot-clé focus</em>"}
      </div>
      <div class="ns-title">${escapeHtml(meta.title || "(sans titre)")}</div>
      <ul class="ns-checks">${checks}</ul>
    `;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tick() {
    const meta = extractMeta();
    if (!meta || !meta.title) return;
    chrome.storage.sync.get({ focusKeyword: "" }, (cfg) => {
      const key = `${meta.title}|${meta.description.slice(0, 80)}|${cfg.focusKeyword}`;
      if (key === lastKey && document.getElementById(PANEL_ID)) return;
      lastKey = key;
      render(meta, cfg.focusKeyword || "");
    });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(tick, 600);
  }

  const obs = new MutationObserver(schedule);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  schedule();
  setInterval(schedule, 4000);
})();
