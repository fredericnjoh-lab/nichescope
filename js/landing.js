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
    nav_faq: "FAQ",
    nav_app: "Ouvrir l’app",
    nav_book: "Réserver",
    lang_btn: "EN",
    hero_line1: "Les niches YouTube",
    hero_line2: "qui rapportent vraiment",
    hero_sub: "L’outil gratuit pour creuser. L’audit payant pour livrer le plan.",
    cta_book: "Voir les audits",
    cta_studio: "Lancer le studio gratuit",
    offers_h2: "Gratuit · Audit · Pro",
    offers_lead: "L’outil te montre où creuser. L’audit te livre le plan prêt à publier ou vendre.",
    tier_free: "Gratuit",
    tier_audit: "Audit",
    tier_pro: "Pro",
    price_free: "0 €",
    price_flash: "297 €",
    price_studio: "990 €",
    price_pro: "Sur demande",
    offer_free_title: "Studio self-serve",
    offer_free_body: "Cash Score, Optimize SEO, Scorecard, Idées, extension Chrome. Ta clé YouTube, dans le navigateur.",
    offer_free_1: "Studio Cash + niches + tendances",
    offer_free_2: "Optimize + extension YouTube",
    offer_free_3: "Compare chaînes & outliers",
    offer_free_4: "Topic tracker local",
    offer_free_cta: "Ouvrir l’app →",
    offer_flash_title: "Audit Flash — 48–72h",
    offer_flash_body: "Idéal pour valider une niche avant de produire. Livrable PDF branded.",
    offer_flash_1: "1 niche cash scorée",
    offer_flash_2: "2 concurrents analysés",
    offer_flash_3: "8 titres + calendrier 2 semaines",
    offer_flash_4: "PDF prêt à forwarder",
    offer_flash_cta: "Réserver le Flash →",
    offer_studio_title: "Audit Studio — plan 4 semaines",
    offer_studio_body: "Pour lancer ou repositionner une chaîne avec un plan actionnable + call.",
    offer_studio_1: "3 niches cash + compare chaînes",
    offer_studio_2: "Outliers + patterns gagnants",
    offer_studio_3: "Calendrier 4 semaines + briefs thumbs",
    offer_studio_4: "Call stratégie 45 min",
    offer_studio_cta: "Réserver le Studio →",
    offer_pro_title: "Pro — tracking & agence",
    offer_pro_body: "Pour suivre des keywords dans le temps et industrialiser les audits clients.",
    offer_pro_1: "Rankings + historique + cron quotidien",
    offer_pro_2: "Exports client & branding avancé",
    offer_pro_3: "Pipeline cloud (multi-device)",
    offer_pro_4: "Self-host possible dès aujourd’hui (Supabase)",
    offer_pro_cta: "Parler Pro →",
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
    offers_h2: "Free · Audit · Pro",
    offers_lead: "The tool shows where to dig. The audit delivers a plan ready to publish or sell.",
    tier_free: "Free",
    tier_audit: "Audit",
    tier_pro: "Pro",
    price_free: "$0",
    price_flash: "$297",
    price_studio: "$990",
    price_pro: "On request",
    offer_free_title: "Self-serve studio",
    offer_free_body: "Cash Score, Optimize SEO, Scorecard, Ideas, Chrome extension. Your YouTube key, in the browser.",
    offer_free_1: "Cash Studio + niches + trending",
    offer_free_2: "Optimize + YouTube extension",
    offer_free_3: "Channel compare & outliers",
    offer_free_4: "Local topic tracker",
    offer_free_cta: "Open the app →",
    offer_flash_title: "Flash Audit — 48–72h",
    offer_flash_body: "Best to validate a niche before you produce. Branded PDF deliverable.",
    offer_flash_1: "1 scored cash niche",
    offer_flash_2: "2 competitors analyzed",
    offer_flash_3: "8 titles + 2-week calendar",
    offer_flash_4: "PDF ready to forward",
    offer_flash_cta: "Book Flash →",
    offer_studio_title: "Studio Audit — 4-week plan",
    offer_studio_body: "To launch or reposition a channel with an actionable plan + call.",
    offer_studio_1: "3 cash niches + channel compare",
    offer_studio_2: "Outliers + winning patterns",
    offer_studio_3: "4-week calendar + thumb briefs",
    offer_studio_4: "45-min strategy call",
    offer_studio_cta: "Book Studio →",
    offer_pro_title: "Pro — tracking & agency",
    offer_pro_body: "Track keywords over time and industrialize client audits.",
    offer_pro_1: "Rankings + history + daily cron",
    offer_pro_2: "Client exports & advanced branding",
    offer_pro_3: "Cloud pipeline (multi-device)",
    offer_pro_4: "Self-host available today (Supabase)",
    offer_pro_cta: "Talk Pro →",
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

  const btn = document.getElementById("langToggle");
  if (btn) btn.textContent = lt("lang_btn");
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
  refresh();
  document.getElementById("langToggle")?.addEventListener("click", () => {
    setLang(getLang() === "fr" ? "en" : "fr");
    refresh();
  });
});
