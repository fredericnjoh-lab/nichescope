/** Agency / personal branding for landing + audit reports */

import { BRAND_KEY } from "./constants.js";

const DEFAULTS = {
  name: "NicheScope",
  mark: "NS",
  tagline: "Audits YouTube qui monétisent",
  analystName: "",
  email: "",
  phone: "",
  calendlyUrl: "",
  website: "https://fredericnjoh-lab.github.io/nichescope/",
  offerFlash: "Audit Flash — 48–72h",
  offerStudio: "Audit Studio — plan 4 semaines",
};

export function getBrand() {
  try {
    const raw = localStorage.getItem(BRAND_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveBrand(partial) {
  const next = { ...getBrand(), ...partial };
  // Sanitize calendly / website URLs
  next.calendlyUrl = safeHttpUrl(next.calendlyUrl);
  next.website = safeHttpUrl(next.website) || DEFAULTS.website;
  localStorage.setItem(BRAND_KEY, JSON.stringify(next));
  return next;
}

export function safeHttpUrl(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

export function calendlyHref(brand = getBrand(), { offer = "" } = {}) {
  const base = safeHttpUrl(brand.calendlyUrl);
  if (!base) return "";
  try {
    const u = new URL(base);
    if (offer) {
      u.searchParams.set("utm_source", "nichescope");
      u.searchParams.set("utm_medium", "landing");
      u.searchParams.set("utm_campaign", offer);
    }
    return u.toString();
  } catch {
    return base;
  }
}

export function mailtoHref(brand = getBrand(), { offer = "" } = {}) {
  const email = String(brand.email || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  const url = new URL(`mailto:${email}`);
  const subject = offer === "flash"
    ? "Audit Flash NicheScope"
    : offer === "studio"
      ? "Audit Studio NicheScope"
      : offer === "pro"
        ? "NicheScope Pro"
        : "Audit YouTube NicheScope";
  url.searchParams.set("subject", subject);
  return url.toString();
}
