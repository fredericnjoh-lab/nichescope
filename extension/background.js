/** Badge score on the extension icon */

function setBadge(score) {
  if (score == null || Number.isNaN(score)) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  const n = Math.round(score);
  chrome.action.setBadgeText({ text: String(n) });
  let color = "#e5484d";
  if (n >= 70) color = "#3dd68c";
  else if (n >= 40) color = "#e6b84d";
  chrome.action.setBadgeBackgroundColor({ color });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "ns-score") setBadge(msg.score);
});

chrome.tabs.onActivated.addListener(() => setBadge(null));
