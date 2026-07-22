const focusEl = document.getElementById("focus");
const statusEl = document.getElementById("status");

chrome.storage.sync.get({ focusKeyword: "" }, (cfg) => {
  focusEl.value = cfg.focusKeyword || "";
});

document.getElementById("save").addEventListener("click", () => {
  const focusKeyword = focusEl.value.trim();
  chrome.storage.sync.set({ focusKeyword }, () => {
    statusEl.hidden = false;
    setTimeout(() => { statusEl.hidden = true; }, 1500);
  });
});
