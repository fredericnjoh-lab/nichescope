const APP = "https://fredericnjoh-lab.github.io/nichescope/app.html";

const focusEl = document.getElementById("focus");
const langEl = document.getElementById("lang");
const enabledEl = document.getElementById("enabled");
const statusEl = document.getElementById("status");
const openOpt = document.getElementById("open-opt");

const copy = {
  fr: {
    sub: "Score titre / desc / tags sur YouTube",
    enabled: "Afficher le panel",
    focus: "Mot-clé focus",
    lang: "Langue",
    save: "Sauver",
    saved: "Sauvé ✓",
    hint: "Reload la page YouTube après installation / update.",
  },
  en: {
    sub: "Score title / desc / tags on YouTube",
    enabled: "Show panel",
    focus: "Focus keyword",
    lang: "Language",
    save: "Save",
    saved: "Saved ✓",
    hint: "Reload the YouTube page after install / update.",
  },
};

function applyUiLang(lang) {
  const c = copy[lang === "en" ? "en" : "fr"];
  document.getElementById("sub").textContent = c.sub;
  document.getElementById("lbl-enabled").textContent = c.enabled;
  document.getElementById("lbl-focus").textContent = c.focus;
  document.getElementById("lbl-lang").textContent = c.lang;
  document.getElementById("save").textContent = c.save;
  document.getElementById("hint").textContent = c.hint;
  statusEl.textContent = c.saved;
}

function syncOptLink() {
  const u = new URL(APP);
  u.searchParams.set("tab", "optimize");
  const q = focusEl.value.trim();
  if (q) u.searchParams.set("q", q);
  openOpt.href = u.toString();
}

chrome.storage.sync.get(
  { focusKeyword: "", lang: "fr", panelEnabled: true },
  (cfg) => {
    focusEl.value = cfg.focusKeyword || "";
    langEl.value = cfg.lang === "en" ? "en" : "fr";
    enabledEl.checked = cfg.panelEnabled !== false;
    applyUiLang(langEl.value);
    syncOptLink();
  },
);

langEl.addEventListener("change", () => applyUiLang(langEl.value));
focusEl.addEventListener("input", syncOptLink);

document.getElementById("save").addEventListener("click", () => {
  const focusKeyword = focusEl.value.trim();
  const lang = langEl.value === "en" ? "en" : "fr";
  const panelEnabled = enabledEl.checked;
  chrome.storage.sync.set({ focusKeyword, lang, panelEnabled }, () => {
    statusEl.hidden = false;
    setTimeout(() => { statusEl.hidden = true; }, 1500);
    // Ask active tab to refresh panel
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "ns-refresh" }).catch(() => {});
      }
    });
  });
});
