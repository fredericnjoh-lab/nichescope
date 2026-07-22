/** Standalone SEO scorer for the Chrome extension (mirrors js/seo.js scoreVideoSeo). */
(function (global) {
  function bracket(score) {
    if (score >= 70) return { label: "High", cls: "high" };
    if (score >= 40) return { label: "Medium", cls: "med" };
    return { label: "Low", cls: "low" };
  }

  function scoreVideoSeo({ title = "", description = "", tags = [], focusKeyword = "" } = {}) {
    const checks = [];
    const kw = (focusKeyword || "").trim().toLowerCase();
    const titleL = title.toLowerCase();
    const descL = description.toLowerCase();
    const tagList = (tags || []).map((t) => String(t).toLowerCase());
    const tagStr = tagList.join(" ");

    const add = (id, pass, weight, tip) => {
      checks.push({ id, pass, weight, tip, points: pass ? weight : 0 });
    };

    const titleLen = title.trim().length;
    add("title_length", titleLen >= 40 && titleLen <= 70, 12, "Titre 40–70 caractères");
    add("title_not_empty", titleLen >= 10, 8, "Titre présent");
    add("title_keyword", !kw || titleL.includes(kw), 14, "Mot-clé focus dans le titre");
    add("title_caps", title.length > 0 && title !== title.toUpperCase(), 6, "Évite le TITRE EN MAJUSCULES");

    const descLen = description.trim().length;
    add("desc_length", descLen >= 150, 12, "Description ≥ 150 caractères");
    add(
      "desc_keyword",
      !kw || !descLen || descL.slice(0, 150).includes(kw) || descL.includes(kw),
      10,
      "Mot-clé dans la description",
    );
    add(
      "desc_links",
      !descLen || /https?:\/\//i.test(description) || descLen < 150,
      4,
      "Lien / CTA dans la description",
    );

    const tagCount = tagList.filter(Boolean).length;
    add("tags_count", tagCount >= 8 && tagCount <= 25, 12, "8–25 tags");
    add(
      "tags_keyword",
      !kw || tagList.some((t) => t.includes(kw) || kw.includes(t)) || tagStr.includes(kw),
      12,
      "Mot-clé dans les tags",
    );
    add(
      "tags_variety",
      tagCount === 0 || new Set(tagList).size >= Math.min(5, tagCount),
      4,
      "Tags non dupliqués",
    );

    const max = checks.reduce((s, c) => s + c.weight, 0);
    const earned = checks.reduce((s, c) => s + c.points, 0);
    const score = max ? Math.round((earned / max) * 100) : 0;

    return {
      score,
      bracket: bracket(score),
      checks,
      passed: checks.filter((c) => c.pass).length,
      total: checks.length,
    };
  }

  global.NicheScopeSeo = { scoreVideoSeo, bracket };
})(typeof globalThis !== "undefined" ? globalThis : window);
