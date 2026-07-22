(function () {
  const PANEL_ID = "nschost-seo-panel";
  const APP_BASE = "https://fredericnjoh-lab.github.io/nichescope/app.html";

  let lastKey = "";
  let timer = null;
  let collapsed = false;
  let dragState = null;
  let settings = {
    focusKeyword: "",
    lang: "fr",
    panelEnabled: true,
    panelPos: null,
  };

  const i18n = {
    fr: {
      loading: "Analyse…",
      noPage: "Ouvre une vidéo YouTube ou l’éditeur Studio.",
      noFocus: "pas de mot-clé",
      focusPh: "Mot-clé focus",
      apply: "OK",
      suggest: "Déduire",
      openOpt: "Optimize",
      openApp: "App",
      minimize: "Réduire",
      expand: "Agrandir",
      close: "Fermer",
      chars: "car.",
      watch: "Watch",
      studio: "Studio",
      shorts: "Shorts",
      skip: "n/a",
    },
    en: {
      loading: "Analyzing…",
      noPage: "Open a YouTube video or Studio editor.",
      noFocus: "no focus keyword",
      focusPh: "Focus keyword",
      apply: "OK",
      suggest: "Guess",
      openOpt: "Optimize",
      openApp: "App",
      minimize: "Minimize",
      expand: "Expand",
      close: "Close",
      chars: "chars",
      watch: "Watch",
      studio: "Studio",
      shorts: "Shorts",
      skip: "n/a",
    },
  };

  function t(key) {
    return (i18n[settings.lang === "en" ? "en" : "fr"] || i18n.fr)[key] || key;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function textOf(sel, root = document) {
    const el = root.querySelector(sel);
    if (!el) return "";
    if ("value" in el && el.value) return String(el.value).trim();
    return (el.textContent || "").trim();
  }

  function metaContent(name) {
    const el =
      document.querySelector(`meta[name="${name}"]`) ||
      document.querySelector(`meta[property="${name}"]`);
    return (el?.getAttribute("content") || "").trim();
  }

  function videoIdFromUrl() {
    try {
      const u = new URL(location.href);
      if (u.pathname.startsWith("/shorts/")) {
        return u.pathname.split("/")[2] || "";
      }
      return u.searchParams.get("v") || "";
    } catch {
      return "";
    }
  }

  function extractWatch() {
    const isShorts = location.pathname.startsWith("/shorts/");
    const title =
      textOf("h1.ytd-watch-metadata yt-formatted-string") ||
      textOf("h1 yt-formatted-string") ||
      textOf("yt-formatted-string.ytd-reel-video-renderer") ||
      textOf("#title h1") ||
      metaContent("og:title").replace(/ - YouTube$/, "") ||
      document.title.replace(/ - YouTube$/, "").trim();

    // Prefer visible description; fall back to meta (no forced expand-click)
    let description =
      textOf("#description-inline-expander .ytd-text-inline-expander") ||
      textOf("#description-inline-expander") ||
      textOf("#description-text") ||
      textOf("ytd-text-inline-expander #content") ||
      textOf("#snippet-text") ||
      metaContent("og:description") ||
      metaContent("description") ||
      "";

    // Clean YouTube UI chrome sometimes mixed in
    description = description
      .replace(/\b\d[\d.,]*\s*(views|vues)\b/gi, "")
      .replace(/\b(Subscribe|S'abonner|Joined|Inscrit)\b/gi, "")
      .trim();

    return {
      title,
      description,
      tags: [],
      tagsKnown: false,
      page: isShorts ? "shorts" : "watch",
      videoId: videoIdFromUrl(),
    };
  }

  function collectChipTags(root) {
    const chips = root.querySelectorAll(
      "ytcp-chip-bar ytcp-chip, #text-input ytcp-chip, [id*='tags'] ytcp-chip, .ytcp-chip",
    );
    const tags = [];
    chips.forEach((chip) => {
      const label = (chip.textContent || "").trim();
      if (label && label.length < 80) tags.push(label);
    });
    return [...new Set(tags)];
  }

  function extractStudio() {
    // Title: first #textbox in details is usually title
    const textboxes = [...document.querySelectorAll("#textbox")];
    let title = "";
    let description = "";

    const titleBox =
      document.querySelector("#title-textarea #textbox") ||
      document.querySelector('div[aria-label*="title" i]#textbox') ||
      document.querySelector('div[aria-label*="titre" i]#textbox') ||
      textboxes[0];
    const descBox =
      document.querySelector("#description-textarea #textbox") ||
      document.querySelector('div[aria-label*="description" i]#textbox') ||
      document.querySelector('div[aria-label*="Description" i]#textbox') ||
      textboxes[1];

    title = (titleBox?.textContent || "").trim();
    description = (descBox?.textContent || "").trim();

    if (!title) {
      title =
        document.querySelector('input[aria-label*="title" i], input[aria-label*="titre" i]')?.value?.trim() ||
        "";
    }
    if (!description) {
      description =
        document.querySelector('textarea[aria-label*="description" i]')?.value?.trim() ||
        "";
    }

    let tags = collectChipTags(document);
    if (!tags.length) {
      const tagsInput =
        document.querySelector("#tags-input input") ||
        document.querySelector('input[aria-label*="tag" i]');
      if (tagsInput?.value) {
        tags = tagsInput.value.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    const onDetails =
      /\/video\//.test(location.pathname) ||
      !!document.querySelector("#title-textarea, #description-textarea");

    if (!onDetails && !title) return null;

    return {
      title,
      description,
      tags,
      tagsKnown: true,
      page: "studio",
      videoId: (location.pathname.match(/\/video\/([^/]+)/) || [])[1] || "",
    };
  }

  function extractMeta() {
    if (location.hostname.includes("studio.youtube.com")) return extractStudio();
    if (location.pathname.startsWith("/watch") || location.pathname.startsWith("/shorts/")) {
      return extractWatch();
    }
    return null;
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          focusKeyword: "",
          lang: "fr",
          panelEnabled: true,
          panelPos: null,
          panelCollapsed: false,
        },
        (cfg) => {
          settings = { ...settings, ...cfg };
          collapsed = !!cfg.panelCollapsed;
          resolve(settings);
        },
      );
    });
  }

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.setAttribute("role", "complementary");
    panel.setAttribute("aria-label", "NicheScope SEO");

    panel.innerHTML = `
      <div class="ns-head" data-drag>
        <div class="ns-brand"><span class="ns-mark">NS</span><strong>NicheScope</strong></div>
        <div class="ns-head-actions">
          <button type="button" class="ns-icon-btn ns-min" title="min">–</button>
          <button type="button" class="ns-icon-btn ns-close" title="close">×</button>
        </div>
      </div>
      <div class="ns-body"></div>
      <div class="ns-foot"></div>
    `;

    panel.querySelector(".ns-close").addEventListener("click", () => {
      chrome.storage.sync.set({ panelEnabled: false });
      settings.panelEnabled = false;
      panel.remove();
    });

    panel.querySelector(".ns-min").addEventListener("click", () => {
      collapsed = !collapsed;
      panel.classList.toggle("ns-collapsed", collapsed);
      chrome.storage.sync.set({ panelCollapsed: collapsed });
      panel.querySelector(".ns-min").textContent = collapsed ? "+" : "–";
      panel.querySelector(".ns-min").title = collapsed ? t("expand") : t("minimize");
    });

    wireDrag(panel);
    applyPos(panel);
    document.documentElement.appendChild(panel);
    return panel;
  }

  function applyPos(panel) {
    const pos = settings.panelPos;
    if (pos && typeof pos.top === "number" && typeof pos.right === "number") {
      panel.style.top = `${pos.top}px`;
      panel.style.right = `${pos.right}px`;
      panel.style.left = "auto";
    }
  }

  function wireDrag(panel) {
    const handle = panel.querySelector("[data-drag]");
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      const rect = panel.getBoundingClientRect();
      dragState = {
        startX: e.clientX,
        startY: e.clientY,
        top: rect.top,
        right: window.innerWidth - rect.right,
      };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragState) return;
      const dy = e.clientY - dragState.startY;
      const dx = e.clientX - dragState.startX;
      const top = Math.max(8, Math.min(window.innerHeight - 80, dragState.top + dy));
      const right = Math.max(8, Math.min(window.innerWidth - 80, dragState.right - dx));
      panel.style.top = `${top}px`;
      panel.style.right = `${right}px`;
      panel.style.left = "auto";
    });
    handle.addEventListener("pointerup", () => {
      if (!dragState) return;
      const top = parseInt(panel.style.top, 10) || 80;
      const right = parseInt(panel.style.right, 10) || 16;
      settings.panelPos = { top, right };
      chrome.storage.sync.set({ panelPos: settings.panelPos });
      dragState = null;
    });
  }

  function optimizeUrl(keyword) {
    const u = new URL(APP_BASE);
    u.searchParams.set("tab", "optimize");
    if (keyword) u.searchParams.set("q", keyword);
    return u.toString();
  }

  function render(meta) {
    if (!settings.panelEnabled) {
      document.getElementById(PANEL_ID)?.remove();
      return;
    }

    const panel = ensurePanel();
    panel.classList.toggle("ns-collapsed", collapsed);
    panel.querySelector(".ns-min").textContent = collapsed ? "+" : "–";

    const focus = settings.focusKeyword || "";
    const result = globalThis.NicheScopeSeo.scoreVideoSeo({
      title: meta.title,
      description: meta.description,
      tags: meta.tags,
      focusKeyword: focus,
      tagsKnown: meta.tagsKnown !== false,
      lang: settings.lang,
    });

    try {
      chrome.runtime.sendMessage({ type: "ns-score", score: result.score });
    } catch { /* no sw */ }

    const pageLabel = t(meta.page) || meta.page;
    const checks = result.checks
      .map((c) => {
        if (c.skipped) {
          return `<li class="skip"><span>–</span> ${escapeHtml(c.tip)}</li>`;
        }
        return `<li class="${c.pass ? "pass" : "fail"}"><span>${c.pass ? "✓" : "○"}</span> ${escapeHtml(c.tip)}</li>`;
      })
      .join("");

    panel.querySelector(".ns-body").innerHTML = `
      <div class="ns-score-row">
        <div class="ns-score ns-${result.bracket.cls}">${result.score}</div>
        <div class="ns-score-side">
          <div class="ns-meta">${escapeHtml(pageLabel)} · ${result.passed}/${result.total}</div>
          <div class="ns-lens">
            <span>T ${result.titleLen} ${t("chars")}</span>
            <span>D ${result.descLen} ${t("chars")}</span>
            ${result.tagsKnown ? `<span>Tags ${result.tagCount}</span>` : `<span>Tags ${t("skip")}</span>`}
          </div>
        </div>
      </div>
      <div class="ns-title">${escapeHtml(meta.title || "—")}</div>
      <div class="ns-focus-row">
        <input type="text" class="ns-focus" placeholder="${escapeHtml(t("focusPh"))}" value="${escapeHtml(focus)}" />
        <button type="button" class="ns-btn ns-apply">${escapeHtml(t("apply"))}</button>
        <button type="button" class="ns-btn ns-ghost ns-suggest">${escapeHtml(t("suggest"))}</button>
      </div>
      <ul class="ns-checks">${checks}</ul>
    `;

    panel.querySelector(".ns-foot").innerHTML = `
      <a class="ns-link" href="${optimizeUrl(focus || meta.title)}" target="_blank" rel="noopener">${escapeHtml(t("openOpt"))}</a>
      <a class="ns-link" href="${APP_BASE}" target="_blank" rel="noopener">${escapeHtml(t("openApp"))}</a>
    `;

    const focusInput = panel.querySelector(".ns-focus");
    panel.querySelector(".ns-apply").addEventListener("click", () => {
      const next = focusInput.value.trim();
      settings.focusKeyword = next;
      chrome.storage.sync.set({ focusKeyword: next }, () => {
        lastKey = "";
        tick();
      });
    });
    focusInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") panel.querySelector(".ns-apply").click();
    });
    panel.querySelector(".ns-suggest").addEventListener("click", () => {
      const guess = globalThis.NicheScopeSeo.suggestFocus(meta.title, settings.lang);
      focusInput.value = guess;
      settings.focusKeyword = guess;
      chrome.storage.sync.set({ focusKeyword: guess }, () => {
        lastKey = "";
        tick();
      });
    });
  }

  async function tick() {
    await loadSettings();
    if (!settings.panelEnabled) {
      document.getElementById(PANEL_ID)?.remove();
      try { chrome.runtime.sendMessage({ type: "ns-score", score: null }); } catch { /* */ }
      return;
    }

    const meta = extractMeta();
    if (!meta || !meta.title) {
      const panel = document.getElementById(PANEL_ID);
      if (panel) {
        panel.querySelector(".ns-body").textContent = t("noPage");
      }
      return;
    }

    const key = [
      location.href,
      meta.title,
      meta.description.slice(0, 120),
      meta.tags.join(","),
      settings.focusKeyword,
      settings.lang,
      meta.tagsKnown,
    ].join("|");

    if (key === lastKey && document.getElementById(PANEL_ID)) return;
    lastKey = key;
    render(meta);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { tick(); }, 500);
  }

  function onNavigate() {
    lastKey = "";
    schedule();
  }

  // YouTube SPA events
  window.addEventListener("yt-navigate-finish", onNavigate);
  window.addEventListener("yt-page-data-updated", onNavigate);
  document.addEventListener("yt-navigate-finish", onNavigate);
  window.addEventListener("popstate", onNavigate);

  const obs = new MutationObserver(schedule);
  const root = document.querySelector("ytd-app") || document.querySelector("#content") || document.body;
  if (root) obs.observe(root, { childList: true, subtree: true });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.focusKeyword || changes.lang || changes.panelEnabled || changes.panelPos) {
      lastKey = "";
      schedule();
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "ns-refresh") {
      lastKey = "";
      schedule();
    }
  });

  loadSettings().then(schedule);
  setInterval(schedule, 5000);
})();
