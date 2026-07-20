import { getBrand, calendlyHref, mailtoHref } from "./brand.js";
import { loadLang, getLang, setLang } from "./i18n.js";

/** Escape text then allow only <strong>…</strong> for proof lines */
function safeStrongHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;strong&gt;/g, "<strong>")
    .replace(/&lt;\/strong&gt;/g, "</strong>");
}

const LAND = {
  fr: {
    skip: "Contenu",
    nav_offers: "Offres",
    nav_app: "Ouvrir l’app",
    nav_book: "Réserver",
    lang_btn: "EN",
    hero_line1: "Les niches YouTube",
    hero_line2: "qui rapportent vraiment",
    hero_sub: "Où est l’argent dans ta niche, qui le prend, et quoi publier les 4 prochaines semaines.",
    cta_book: "Réserver un audit",
    cta_studio: "Lancer le studio",
    offers_h2: "Deux façons de démarrer",
    offers_lead: "Un livrable clair. Pas de blabla dashboard.",
    offer_flash_title: "Audit Flash — 48–72h",
    offer_flash_body: "1 niche · 2 concurrents · 8 titres · calendrier 2 semaines · PDF branded",
    offer_flash_cta: "Réserver le Flash →",
    offer_studio_title: "Audit Studio — plan 4 semaines",
    offer_studio_body: "3 niches cash · compare chaînes · outliers · plan éditorial + briefs thumbs · call stratégie",
    offer_studio_cta: "Réserver le Studio →",
    proof_h2: "Ce que tu reçois",
    proof_1: "<strong>Cash Score</strong> — niches classées par potentiel monétaire (RPM × demande × facilité)",
    proof_2: "<strong>Profils chaînes</strong> — estimation AdSense, outliers, efficacité $",
    proof_3: "<strong>Plan éditorial</strong> — titres + briefs thumbnails prêts à tourner",
    proof_4: "<strong>PDF imprimable</strong> — à forwarder à ton équipe ou ton client",
    close_h2: "Prêt à voir où est l’argent ?",
    close_tagline: "Audits YouTube qui monétisent",
    cta_calendly: "Booker sur Calendly",
    cta_email: "Écrire un email",
    foot_app: "App studio",
    setup_hint: "Configure ton Calendly dans l’app (⚙ Branding) pour activer la réservation.",
    doc_title: "NicheScope — Audits YouTube qui monétisent",
    meta_desc: "Trouve les niches YouTube qui rapportent. Audit Flash ou Audit Studio : Cash Score, concurrents, calendrier éditorial, briefs titres & thumbnails.",
    og_desc: "Où est l’argent dans ta niche, qui le prend, et quoi publier les 4 prochaines semaines.",
  },
  en: {
    skip: "Content",
    nav_offers: "Offers",
    nav_app: "Open app",
    nav_book: "Book",
    lang_btn: "FR",
    hero_line1: "YouTube niches",
    hero_line2: "that actually pay",
    hero_sub: "Where the money is in your niche, who takes it, and what to publish for the next 4 weeks.",
    cta_book: "Book an audit",
    cta_studio: "Launch the studio",
    offers_h2: "Two ways to start",
    offers_lead: "A clear deliverable. No dashboard fluff.",
    offer_flash_title: "Flash Audit — 48–72h",
    offer_flash_body: "1 niche · 2 competitors · 8 titles · 2-week calendar · branded PDF",
    offer_flash_cta: "Book Flash →",
    offer_studio_title: "Studio Audit — 4-week plan",
    offer_studio_body: "3 cash niches · channel compare · outliers · editorial plan + thumb briefs · strategy call",
    offer_studio_cta: "Book Studio →",
    proof_h2: "What you get",
    proof_1: "<strong>Cash Score</strong> — niches ranked by money potential (RPM × demand × ease)",
    proof_2: "<strong>Channel profiles</strong> — AdSense estimate, outliers, money efficiency",
    proof_3: "<strong>Editorial plan</strong> — titles + thumbnail briefs ready to shoot",
    proof_4: "<strong>Printable PDF</strong> — forward to your team or client",
    close_h2: "Ready to see where the money is?",
    close_tagline: "YouTube audits that monetize",
    cta_calendly: "Book on Calendly",
    cta_email: "Send an email",
    foot_app: "Studio app",
    setup_hint: "Set your Calendly URL in the app (⚙ Branding) to enable booking.",
    doc_title: "NicheScope — YouTube audits that monetize",
    meta_desc: "Find YouTube niches that make money. Flash Audit or Studio Audit: Cash Score, competitors, editorial calendar, title & thumbnail briefs.",
    og_desc: "Where the money is in your niche, who takes it, and what to publish for the next 4 weeks.",
  },
};

function lt(key) {
  const lang = getLang();
  return LAND[lang]?.[key] ?? LAND.en[key] ?? key;
}

function applyLandingI18n() {
  document.documentElement.lang = getLang();
  document.title = lt("doc_title");
  const meta = document.getElementById("meta-desc");
  if (meta) meta.setAttribute("content", lt("meta_desc"));
  const ogTitle = document.getElementById("og-title");
  if (ogTitle) ogTitle.setAttribute("content", lt("doc_title"));
  const ogDesc = document.getElementById("og-desc");
  if (ogDesc) ogDesc.setAttribute("content", lt("og_desc"));

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = lt(key);
  });
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    if (key) el.innerHTML = safeStrongHtml(lt(key));
  });

  const btn = document.getElementById("langToggle");
  if (btn) btn.textContent = lt("lang_btn");
}

function applyLandingBrand() {
  const b = getBrand();
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el && text != null) el.textContent = text;
  };

  set("brand-mark", b.mark || "NS");
  set("brand-name", b.name || "NicheScope");
  set("hero-brand", b.name || "NicheScope");
  set("foot-brand", b.name || "NicheScope");

  // Offer titles come from i18n (data-i18n already applied); keep brand tagline if set
  const taglineEl = document.getElementById("close-tagline");
  if (taglineEl && b.tagline) {
    taglineEl.textContent = b.tagline;
  }

  const analystBits = [b.analystName, b.email, b.phone].filter(Boolean);
  const analystLine = document.getElementById("analyst-line");
  if (analystLine) {
    analystLine.textContent = analystBits.join(" · ");
  }

  const cal = calendlyHref(b);
  const mail = mailtoHref(b);
  const bookHref = cal || mail || "#contact";

  ["nav-calendly", "cta-calendly", "cta-calendly-2", "cta-flash", "cta-studio"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute("href", bookHref);
    if (cal) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
    } else {
      el.removeAttribute("target");
      el.removeAttribute("rel");
    }
  });

  const emailCta = document.getElementById("cta-email");
  if (emailCta) {
    if (mail) {
      emailCta.setAttribute("href", mail);
      emailCta.hidden = false;
    } else {
      emailCta.hidden = true;
    }
  }

  if (!cal && !mail && analystLine && !analystLine.textContent) {
    analystLine.textContent = lt("setup_hint");
  }
}

function refresh() {
  applyLandingI18n();
  applyLandingBrand();
}

document.addEventListener("DOMContentLoaded", () => {
  loadLang();
  refresh();
  document.getElementById("langToggle")?.addEventListener("click", () => {
    setLang(getLang() === "fr" ? "en" : "fr");
    refresh();
  });
});
