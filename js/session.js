/** Shared in-memory session state (avoids circular imports between features) */

let studioSnap = { clusters: [], topic: "", moneyChannels: [] };
let lastPlan = null;

export function setStudioSnapshot(snap) {
  studioSnap = {
    clusters: snap.clusters || [],
    topic: snap.topic || "",
    moneyChannels: snap.moneyChannels || [],
  };
}

export function getStudioSnapshot() {
  return studioSnap;
}

export function setLastPlan(plan) {
  lastPlan = plan;
}

export function getLastPlan() {
  return lastPlan;
}
