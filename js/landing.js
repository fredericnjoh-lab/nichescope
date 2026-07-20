import { getBrand, calendlyHref, mailtoHref } from "./brand.js";

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
  set("close-tagline", b.tagline || "");
  set("offer-flash", b.offerFlash || "Audit Flash — 48–72h");
  set("offer-studio", b.offerStudio || "Audit Studio — plan 4 semaines");

  const analystBits = [b.analystName, b.email, b.phone].filter(Boolean);
  set("analyst-line", analystBits.join(" · "));

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

  // Soft prompt if Calendly not configured
  if (!cal && !mail) {
    const close = document.querySelector(".close-meta");
    if (close && !close.textContent) {
      close.textContent = "Configure ton Calendly dans l’app (⚙ Branding) pour activer la réservation.";
    }
  }
}

document.addEventListener("DOMContentLoaded", applyLandingBrand);
