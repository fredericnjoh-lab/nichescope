/** Text clustering for niche discovery — EN + FR stopwords */

const STOPWORDS = new Set(`
a an and or the of for to in on at by from with as is are be was were been being
has have had do does did i you he she it we they me my your his her our their
this that these those what which who whom how why when where can will would
should could may might must just only also more most some any all not no but if
then so very too much many really new how-to vs feat ft
le la les un une des du de et ou a au aux en y ce ces cet cette qui que quoi dont
ou où comment pourquoi quand est sont etait été etre être je tu il elle nous vous
ils elles mon ton son ma ta sa mes tes ses notre votre leur leurs plus moins tres
très tout toute tous toutes comme dans pour sur sous avec sans par plusieur plusieurs
`.trim().split(/\s+/));

const JUNK = new Set(`
video videos shorts tutorial guide review reaction official tips tricks ep episode
part full music song movie film clip live stream best top worst greatest amazing
crazy awesome funny daily weekly monthly news update latest year today yesterday
tomorrow week month make made need want know think see look went come came get got
going gonna let lets really actually basically literally probably maybe ever never
always sometimes often something nothing everything anything someone everyone
anybody nobody somewhere everywhere anywhere first second third fourth fifth ago
time times still even back here there now then thing things way ways one two three
four five six seven eight nine ten
vidéo videos tuto tutoriel revue réaction reaction officiel actualité actu année
jour semaine mois faire vouloir savoir voir venir aller vraiment peut-être
`.trim().split(/\s+/));

function stem(w) {
  if (w.length < 4) return w;
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("xes") || w.endsWith("ses") || w.endsWith("zes") || w.endsWith("ches") || w.endsWith("shes"))
    return w.slice(0, -2);
  let r = w;
  if (r.length > 5 && r.endsWith("ing")) r = r.slice(0, -3);
  else if (r.length > 5 && r.endsWith("ed") && !r.endsWith("eed")) r = r.slice(0, -2);
  else if (r.endsWith("s") && !r.endsWith("ss") && !r.endsWith("us") && !r.endsWith("is")) r = r.slice(0, -1);
  if (r.length >= 3 && /([bdfgklmnprstz])\1$/.test(r)) r = r.slice(0, -1);
  return r;
}

export function tokenize(text) {
  return (text || "").toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3 && w.length <= 24 && !STOPWORDS.has(w) && !JUNK.has(w) && !/^\d+$/.test(w))
    .map(stem);
}

export function extractTopTerms(texts, n = 12, weights = null) {
  const counts = new Map();
  texts.forEach((t, idx) => {
    const w = weights ? Math.max(1, Math.log10(1 + weights[idx])) : 1;
    const tokens = tokenize(t);
    const seen = new Set();
    tokens.forEach(token => {
      if (seen.has(token)) return;
      seen.add(token);
      counts.set(token, (counts.get(token) || 0) + w);
    });
    const seen2 = new Set();
    for (let i = 0; i < tokens.length - 1; i++) {
      const bg = tokens[i] + " " + tokens[i + 1];
      if (seen2.has(bg)) continue;
      seen2.add(bg);
      counts.set(bg, (counts.get(bg) || 0) + w * 1.5);
    }
  });

  const terms = [...counts.entries()]
    .filter(([, c]) => c >= 1.5)
    .sort((a, b) => b[1] - a[1]);

  const kept = [];
  for (const [term, score] of terms) {
    const dup = kept.find(([k]) => {
      if (k === term) return true;
      if (k.split(" ").includes(term)) return true;
      if (k.includes(term) && k.length - term.length < 4) return true;
      if (term.includes(k) && term.length - k.length < 4) return false;
      return false;
    });
    if (!dup) kept.push([term, score]);
    if (kept.length >= n) break;
  }
  return kept;
}
