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
    nav_usecases: "Cas d’usage",
    nav_offers: "Offres",
    nav_faq: "FAQ",
    nav_app: "Ouvrir l’app",
    nav_book: "Réserver",
    lang_btn: "EN",
    hero_line1: "Les niches YouTube",
    hero_line2: "qui rapportent vraiment",
    hero_sub: "L’outil gratuit pour creuser. L’audit payant pour livrer le plan.",
    cta_book: "Voir les audits",
    cta_studio: "Lancer le studio gratuit",
    uc_eyebrow: "Voir en action",
    uc_h2: "Des cas d’usage concrets — pas de slides marketing",
    uc_lead: "Comme ManyChat montre ses flows : voici NicheScope sur de vrais scénarios créateur.",
    uc_tab_studio: "Trouver une niche cash",
    uc_tab_seo: "Optimiser avant de publier",
    uc_tab_scorecard: "Battre un concurrent",
    uc_tab_rankings: "Tracker ses keywords",
    uc_studio_title: "Scanner une verticale et sortir les niches qui paient",
    uc_studio_body: "Entre un thème (ex. finance perso). NicheScope classe les sous-niches par Cash Score — RPM, demande, facilité, affilié — pour savoir où tourner en premier.",
    uc_seo_title: "Scorer ton SEO avant d’appuyer sur Publier",
    uc_seo_body: "Titres, volume, compétition, opportunity score. Des suggestions prêtes à coller — le réflexe vidIQ, dans la charte NicheScope.",
    uc_scorecard_title: "Comparer deux chaînes et voler ce qui marche",
    uc_scorecard_body: "Vues/vidéo, efficacité $, outliers, cadence. Tu vois qui monétise vraiment — pas juste qui a le plus d’abonnés.",
    uc_rankings_title: "Suivre tes keywords jour après jour",
    uc_rankings_body: "Sparklines, positions, deltas. Tu sais si tu grimpes, stagnes, ou si un concurrent te dépasse — idéal Pro / agence.",
    uc_cta: "Essayer dans le studio",
    uc_alt_studio: "Capture NicheScope — Studio Cash avec niches scorées",
    uc_alt_seo: "Capture NicheScope — Optimize SEO avec score 82",
    uc_alt_scorecard: "Capture NicheScope — Scorecard comparaison de chaînes",
    uc_alt_rankings: "Capture NicheScope — Rankings keywords avec sparklines",
    plans_eyebrow: "Tarifs & plans",
    offers_h2: "Choisis comment tu veux grandir",
    offers_lead: "Tout est conçu pour trouver où est l’argent — et livrer un plan actionnable.",
    ribbon_popular: "Le plus populaire",
    ribbon_powerful: "Le plus puissant",
    billing_free: "Outils de base inclus. Upgrade quand tu veux.",
    billing_flash: "Paiement unique · livré en 48–72h",
    billing_studio: "Paiement unique · call 45 min inclus",
    enterprise_includes: "Inclus :",
    tier_free: "Gratuit",
    tier_audit: "Audit",
    tier_pro: "Pro",
    price_free: "0 €",
    price_flash: "297 €",
    price_studio: "990 €",
    price_pro: "Sur demande",
    offer_free_title: "Free",
    offer_free_body: "Teste les outils créateur puissants",
    offer_free_1: "Studio Cash + niches + tendances",
    offer_free_2: "Optimize SEO + extension Chrome",
    offer_free_3: "Scorecard concurrents & outliers",
    offer_free_4: "Idées + topic tracker local",
    offer_free_cta: "Commencer gratuitement",
    offer_flash_name: "Flash",
    offer_flash_title: "Audit Flash — 48–72h",
    offer_flash_body: "Audit express pour valider une niche",
    offer_flash_1: "1 niche cash scorée",
    offer_flash_2: "2 concurrents analysés",
    offer_flash_3: "8 titres + calendrier 2 semaines",
    offer_flash_4: "PDF branded prêt à forwarder",
    offer_flash_cta: "Réserver Flash",
    offer_studio_name: "Studio",
    offer_studio_title: "Audit Studio — plan 4 semaines",
    offer_studio_body: "Plan 4 semaines + call stratégie",
    offer_studio_plus: "Tout Flash, plus :",
    offer_studio_1: "3 niches cash + compare chaînes",
    offer_studio_2: "Outliers + patterns gagnants",
    offer_studio_3: "Calendrier 4 semaines + briefs thumbs",
    offer_studio_4: "Call stratégie 45 min",
    offer_studio_cta: "Réserver Studio",
    offer_pro_title: "Pour marques, agences & multi-chaînes",
    offer_pro_body: "Contrôle centralisé. Accès scalable. Visibilité complète sur tes keywords.",
    offer_pro_1: "Rankings + historique + cron quotidien",
    offer_pro_2: "Exports client & branding avancé",
    offer_pro_3: "Pipeline cloud (multi-device)",
    offer_pro_4: "Self-host possible dès aujourd’hui (Supabase)",
    offer_pro_cta: "En savoir plus",
    proof_h2: "Ce que tu reçois (audit)",
    proof_1: "<strong>Cash Score</strong> — niches classées par potentiel monétaire (RPM × demande × facilité)",
    proof_2: "<strong>Profils chaînes</strong> — estimation AdSense, outliers, efficacité $",
    proof_3: "<strong>Plan éditorial</strong> — titres + briefs thumbnails prêts à tourner",
    proof_4: "<strong>PDF imprimable</strong> — à forwarder à ton équipe ou ton client",
    faq_h2: "FAQ",
    faq_1_q: "L’app est vraiment gratuite ?",
    faq_1_a: "Oui. Tu utilises ta clé YouTube Data API. Pas de carte bancaire.",
    faq_2_q: "Quelle est la différence avec l’audit ?",
    faq_2_a: "L’app t’aide à explorer. L’audit est un livrable fait pour toi (analyse + plan + PDF), avec un délai et un call si Studio.",
    faq_3_q: "C’est quoi Pro ?",
    faq_3_a: "Le tracking keywords dans le temps (Rankings + cron) et les usages agence. Tu peux déjà self-hoster Rankings avec Supabase ; l’offre hébergée arrive ensuite.",
    faq_4_q: "Les prix incluent quoi ?",
    faq_4_a: "Flash = PDF en 48–72h. Studio = plan 4 semaines + call. Pas d’abonnement forcé sur les audits.",
    close_h2: "Prêt à voir où est l’argent ?",
    close_tagline: "Audits YouTube qui monétisent",
    cta_calendly: "Booker sur Calendly",
    cta_email: "Écrire un email",
    foot_app: "App studio",
    setup_hint: "Configure ton Calendly dans l’app (⚙ Branding) pour activer la réservation.",
    doc_title: "NicheScope — Gratuit, audits & Pro",
    meta_desc: "Studio YouTube gratuit + audits Flash/Studio payants. Cash Score, concurrents, calendrier, Rankings Pro.",
    og_desc: "L’outil gratuit pour creuser. L’audit payant pour livrer le plan.",
  },
  en: {
    skip: "Content",
    nav_usecases: "Use cases",
    nav_offers: "Offers",
    nav_faq: "FAQ",
    nav_app: "Open app",
    nav_book: "Book",
    lang_btn: "FR",
    hero_line1: "YouTube niches",
    hero_line2: "that actually pay",
    hero_sub: "The free tool to dig. The paid audit to deliver the plan.",
    cta_book: "See paid audits",
    cta_studio: "Launch the free studio",
    uc_eyebrow: "See it in action",
    uc_h2: "Real use cases — not marketing slides",
    uc_lead: "Like ManyChat shows its flows: here’s NicheScope on real creator scenarios.",
    uc_tab_studio: "Find a cash niche",
    uc_tab_seo: "Optimize before publish",
    uc_tab_scorecard: "Beat a competitor",
    uc_tab_rankings: "Track your keywords",
    uc_studio_title: "Scan a vertical and surface niches that pay",
    uc_studio_body: "Enter a theme (e.g. personal finance). NicheScope ranks sub-niches by Cash Score — RPM, demand, ease, affiliate — so you know what to shoot first.",
    uc_seo_title: "Score your SEO before you hit Publish",
    uc_seo_body: "Titles, volume, competition, opportunity score. Paste-ready suggestions — the vidIQ reflex, in NicheScope red.",
    uc_scorecard_title: "Compare two channels and steal what works",
    uc_scorecard_body: "Views/video, $ efficiency, outliers, cadence. See who actually monetizes — not just who has more subs.",
    uc_rankings_title: "Watch your keywords day after day",
    uc_rankings_body: "Sparklines, positions, deltas. Know if you’re climbing, stalling, or losing ground — built for Pro / agencies.",
    uc_cta: "Try it in the studio",
    uc_alt_studio: "NicheScope screenshot — Cash Studio with scored niches",
    uc_alt_seo: "NicheScope screenshot — Optimize SEO with score 82",
    uc_alt_scorecard: "NicheScope screenshot — channel Scorecard comparison",
    uc_alt_rankings: "NicheScope screenshot — Rankings keywords with sparklines",
    plans_eyebrow: "Pricing & plans",
    offers_h2: "Choose how you want to grow",
    offers_lead: "Everything built to find where the money is — and deliver an actionable plan.",
    ribbon_popular: "Most popular",
    ribbon_powerful: "Most powerful",
    billing_free: "Core tools included. Upgrade anytime.",
    billing_flash: "One-time · delivered in 48–72h",
    billing_studio: "One-time · 45-min call included",
    enterprise_includes: "What's included:",
    tier_free: "Free",
    tier_audit: "Audit",
    tier_pro: "Pro",
    price_free: "$0",
    price_flash: "$297",
    price_studio: "$990",
    price_pro: "On request",
    offer_free_title: "Free",
    offer_free_body: "Test drive powerful creator tools",
    offer_free_1: "Cash Studio + niches + trending",
    offer_free_2: "Optimize SEO + Chrome extension",
    offer_free_3: "Competitor scorecard & outliers",
    offer_free_4: "Ideas + local topic tracker",
    offer_free_cta: "Start for free",
    offer_flash_name: "Flash",
    offer_flash_title: "Flash Audit — 48–72h",
    offer_flash_body: "Express audit to validate a niche",
    offer_flash_1: "1 scored cash niche",
    offer_flash_2: "2 competitors analyzed",
    offer_flash_3: "8 titles + 2-week calendar",
    offer_flash_4: "Branded PDF ready to forward",
    offer_flash_cta: "Book Flash",
    offer_studio_name: "Studio",
    offer_studio_title: "Studio Audit — 4-week plan",
    offer_studio_body: "4-week plan + strategy call",
    offer_studio_plus: "Everything in Flash, plus:",
    offer_studio_1: "3 cash niches + channel compare",
    offer_studio_2: "Outliers + winning patterns",
    offer_studio_3: "4-week calendar + thumb briefs",
    offer_studio_4: "45-min strategy call",
    offer_studio_cta: "Book Studio",
    offer_pro_title: "For brands, agencies & multi-channel",
    offer_pro_body: "Centralized control. Scalable access. Full keyword visibility.",
    offer_pro_1: "Rankings + history + daily cron",
    offer_pro_2: "Client exports & advanced branding",
    offer_pro_3: "Cloud pipeline (multi-device)",
    offer_pro_4: "Self-host available today (Supabase)",
    offer_pro_cta: "Learn more",
    proof_h2: "What you get (audit)",
    proof_1: "<strong>Cash Score</strong> — niches ranked by money potential (RPM × demand × ease)",
    proof_2: "<strong>Channel profiles</strong> — AdSense estimate, outliers, money efficiency",
    proof_3: "<strong>Editorial plan</strong> — titles + thumbnail briefs ready to shoot",
    proof_4: "<strong>Printable PDF</strong> — forward to your team or client",
    faq_h2: "FAQ",
    faq_1_q: "Is the app really free?",
    faq_1_a: "Yes. You use your own YouTube Data API key. No credit card.",
    faq_2_q: "How is that different from an audit?",
    faq_2_a: "The app helps you explore. An audit is a done-for-you deliverable (analysis + plan + PDF), with a deadline and a call for Studio.",
    faq_3_q: "What is Pro?",
    faq_3_a: "Keyword tracking over time (Rankings + cron) and agency workflows. You can self-host Rankings with Supabase today; hosted Pro comes next.",
    faq_4_q: "What’s included in the price?",
    faq_4_a: "Flash = PDF in 48–72h. Studio = 4-week plan + call. No forced subscription on audits.",
    close_h2: "Ready to see where the money is?",
    close_tagline: "YouTube audits that monetize",
    cta_calendly: "Book on Calendly",
    cta_email: "Send an email",
    foot_app: "Studio app",
    setup_hint: "Set your Calendly URL in the app (⚙ Branding) to enable booking.",
    doc_title: "NicheScope — Free, audits & Pro",
    meta_desc: "Free YouTube studio + paid Flash/Studio audits. Cash Score, competitors, calendar, Pro rankings.",
    og_desc: "The free tool to dig. The paid audit to deliver the plan.",
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
  document.querySelectorAll("[data-i18n-alt]").forEach(el => {
    const key = el.getAttribute("data-i18n-alt");
    if (key) el.setAttribute("alt", lt(key));
  });

  const btn = document.getElementById("langToggle");
  if (btn) btn.textContent = lt("lang_btn");

  // Keep use-case copy in sync with active tab after lang switch
  const activeUc = document.querySelector(".uc-tab.active")?.getAttribute("data-uc") || "studio";
  applyUseCaseCopy(activeUc);
}

const UC_COPY = {
  studio: { title: "uc_studio_title", body: "uc_studio_body" },
  seo: { title: "uc_seo_title", body: "uc_seo_body" },
  scorecard: { title: "uc_scorecard_title", body: "uc_scorecard_body" },
  rankings: { title: "uc_rankings_title", body: "uc_rankings_body" },
};

function applyUseCaseCopy(id) {
  const keys = UC_COPY[id] || UC_COPY.studio;
  const title = document.getElementById("uc-title");
  const body = document.getElementById("uc-body");
  if (title) title.textContent = lt(keys.title);
  if (body) body.textContent = lt(keys.body);
}

function initUseCases() {
  const tabs = [...document.querySelectorAll(".uc-tab")];
  if (!tabs.length) return;

  const show = (id) => {
    tabs.forEach(tab => {
      const on = tab.getAttribute("data-uc") === id;
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll("[data-uc-panel]").forEach(panel => {
      const on = panel.getAttribute("data-uc-panel") === id;
      panel.hidden = !on;
      if (on) {
        panel.style.animation = "none";
        // reflow to restart fade
        void panel.offsetWidth;
        panel.style.animation = "";
      }
    });
    applyUseCaseCopy(id);
  };

  tabs.forEach(tab => {
    tab.addEventListener("click", () => show(tab.getAttribute("data-uc")));
  });
}

function wireOfferLink(el, { cal, mail, offer, fallback }) {
  if (!el) return;
  const href = (cal && calendlyHref(getBrand(), { offer })) || mail || fallback || "#contact";
  el.setAttribute("href", href);
  if (cal && href.startsWith("http")) {
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener");
  } else {
    el.removeAttribute("target");
    el.removeAttribute("rel");
  }
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

  const taglineEl = document.getElementById("close-tagline");
  if (taglineEl && b.tagline) taglineEl.textContent = b.tagline;

  const analystBits = [b.analystName, b.email, b.phone].filter(Boolean);
  const analystLine = document.getElementById("analyst-line");
  if (analystLine) analystLine.textContent = analystBits.join(" · ");

  const cal = calendlyHref(b);
  const mailDefault = mailtoHref(b);
  const bookHref = cal || mailDefault || "#offres";

  ["nav-calendly", "cta-calendly", "cta-calendly-2"].forEach(id => {
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

  wireOfferLink(document.getElementById("cta-flash"), {
    cal, mail: mailtoHref(b, { offer: "flash" }), offer: "flash", fallback: "#contact",
  });
  wireOfferLink(document.getElementById("cta-studio"), {
    cal, mail: mailtoHref(b, { offer: "studio" }), offer: "studio", fallback: "#contact",
  });
  wireOfferLink(document.getElementById("cta-pro"), {
    cal, mail: mailtoHref(b, { offer: "pro" }), offer: "pro", fallback: "#contact",
  });

  const emailCta = document.getElementById("cta-email");
  if (emailCta) {
    if (mailDefault) {
      emailCta.setAttribute("href", mailDefault);
      emailCta.hidden = false;
    } else {
      emailCta.hidden = true;
    }
  }

  if (!cal && !mailDefault && analystLine && !analystLine.textContent) {
    analystLine.textContent = lt("setup_hint");
  }
}

function refresh() {
  applyLandingI18n();
  applyLandingBrand();
}

document.addEventListener("DOMContentLoaded", () => {
  loadLang();
  initUseCases();
  refresh();
  document.getElementById("langToggle")?.addEventListener("click", () => {
    setLang(getLang() === "fr" ? "en" : "fr");
    refresh();
  });
});
