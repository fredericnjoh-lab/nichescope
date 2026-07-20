/** Studio pipeline favorites (niches + channels) */

import { FAV_KEY } from "./constants.js";

export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(arr) {
  localStorage.setItem(FAV_KEY, JSON.stringify(arr.slice(0, 80)));
}

export function favKey(type, id) {
  return `${type}:${id}`;
}

export function isFavorite(type, id) {
  const k = favKey(type, id);
  return getFavorites().some(f => f.key === k);
}

export function toggleFavorite(item) {
  const key = favKey(item.type, item.id);
  let arr = getFavorites();
  const idx = arr.findIndex(f => f.key === key);
  if (idx >= 0) {
    arr.splice(idx, 1);
    save(arr);
    return false;
  }
  arr.unshift({
    key,
    type: item.type,
    id: item.id,
    title: item.title,
    meta: item.meta || {},
    t: Date.now(),
  });
  save(arr);
  return true;
}

export function removeFavorite(type, id) {
  const key = favKey(type, id);
  save(getFavorites().filter(f => f.key !== key));
}
