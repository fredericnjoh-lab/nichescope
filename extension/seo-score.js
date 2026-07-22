/** Standalone SEO scorer for the Chrome extension (mirrors js/seo.js). */
(function (global) {
  const TIPS = {
    fr: {
      title_length: "Titre 40–70 caractères",
      title_not_empty: "Titre présent",
      title_keyword: "Mot-clé focus dans le titre",
      title_caps: "Évite le TITRE EN MAJUSCULES",
      desc_length: "Description ≥ 150 caractères",
      desc_keyword: "Mot-clé dans la description",
      desc_links: "Lien / CTA dans la description",
      tags_count: "8–25 tags",
      tags_keyword: "Mot-clé dans les tags",
      tags_variety: "Tags non dupliqués",
      tags_unknown: "Tags non visibles sur cette page",
    },
    en: {
      title_length: "Title length 40–70 characters",
      title_not_empty: "Title is present",
      title_keyword: "Focus keyword in the title",
      title_caps: "Avoid ALL-CAPS titles",
      desc_length: "Description ≥ 150 characters",
      desc_keyword: "Keyword in the description",
      desc_links: "Link / CTA in the description",
      tags_count: "8–25 tags",
      tags_keyword: "Focus keyword in tags",
      tags_variety: "No duplicate tags",
      tags_unknown: "Tags not visible on this page",
    },
  };

  function bracket(score) {
    if (score >= 70) return { label: "High", cls: "high" };
    if (score >= 40) return { label: "Medium", cls: "med" };
    return { label: "Low", cls: "low" };
  }

  function scoreVideoSeo({
    title = "",
    description = "",
    tags = [],
    focusKeyword = "",
    tagsKnown = true,
    lang = "fr",
  } = {}) {
    const tips = TIPS[lang === "en" ? "en" : "fr"];
    const checks = [];
    const kw = (focusKeyword || "").trim().toLowerCase();
    const titleL = title.toLowerCase();
    const descL = description.toLowerCase();
    const tagList = (tags || []).map((t) => String(t).toLowerCase()).filter(Boolean);
    const tagStr = tagList.join(" ");

    const add = (id, pass, weight, tip, skipped = false) => {
      checks.push({
        id,
        pass: skipped ? null : pass,
        weight: skipped ? 0 : weight,
        tip,
        points: skipped ? 0 : pass ? weight : 0,
        skipped,
      });
    };

    const titleLen = title.trim().length;
    add("title_length", titleLen >= 40 && titleLen <= 70, 12, tips.title_length);
    add("title_not_empty", titleLen >= 10, 8, tips.title_not_empty);
    add("title_keyword", !kw || titleL.includes(kw), 14, tips.title_keyword);
    add("title_caps", title.length > 0 && title !== title.toUpperCase(), 6, tips.title_caps);

    const descLen = description.trim().length;
    add("desc_length", descLen >= 150, 12, tips.desc_length);
    add(
      "desc_keyword",
      !kw || !descLen || descL.slice(0, 150).includes(kw) || descL.includes(kw),
      10,
      tips.desc_keyword,
    );
    add(
      "desc_links",
      !descLen || /https?:\/\//i.test(description) || /www\./i.test(description),
      4,
      tips.desc_links,
    );

    if (!tagsKnown) {
      add("tags_unknown", false, 0, tips.tags_unknown, true);
    } else {
      const tagCount = tagList.length;
      add("tags_count", tagCount >= 8 && tagCount <= 25, 12, tips.tags_count);
      add(
        "tags_keyword",
        !kw || tagList.some((t) => t.includes(kw) || kw.includes(t)) || tagStr.includes(kw),
        12,
        tips.tags_keyword,
      );
      add(
        "tags_variety",
        tagCount === 0 || new Set(tagList).size >= Math.min(5, tagCount),
        4,
        tips.tags_variety,
      );
    }

    const max = checks.reduce((s, c) => s + c.weight, 0);
    const earned = checks.reduce((s, c) => s + c.points, 0);
    const score = max ? Math.round((earned / max) * 100) : 0;
    const scored = checks.filter((c) => !c.skipped);

    return {
      score,
      bracket: bracket(score),
      checks,
      passed: scored.filter((c) => c.pass).length,
      total: scored.length,
      titleLen,
      descLen,
      tagCount: tagList.length,
      tagsKnown,
    };
  }

  /** Suggest a focus keyword from the title (first 2–4 meaningful words). */
  function suggestFocus(title = "", lang = "fr") {
    const stop = new Set(
      (lang === "en"
        ? "a an the of for to in on at by from with how why what when where your my our best top"
        : "le la les un une des du de et ou a au aux en y ce ces comment pourquoi quel quelle pour avec sans"
      ).split(/\s+/),
    );
    const words = String(title)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stop.has(w) && !/^\d+$/.test(w));
    return words.slice(0, 3).join(" ");
  }

  global.NicheScopeSeo = { scoreVideoSeo, bracket, suggestFocus };
})(typeof globalThis !== "undefined" ? globalThis : window);
