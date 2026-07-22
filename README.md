# NicheScope Studio

Outil gratuit (100 % navigateur) pour trouver des **niches YouTube qui monétisent** — et construire ton propre pipeline de studio.

## Packaging

| Tier | Contenu | Prix indicatif |
|------|---------|----------------|
| **Gratuit** | App studio + extension (clé YouTube perso) | 0 € |
| **Audit Flash** | PDF niche + concurrents + titres (48–72h) | 297 € |
| **Audit Studio** | Plan 4 semaines + call | 990 € |
| **Pro** | Rankings / cron / usages agence (hébergé sur demande ; self-host Supabase OK) | Sur demande |

Landing : offres + FAQ. Dans l’app : badges Gratuit / Audit / Pro.

## Avantage compétitif

- **Cash Score (0–100)** — combine RPM de la verticale, demande (vues/jour), opportunité (vues/abonnés) et facilité d’entrée.
- **RPM par verticale** — finance, SaaS/IA, business, santé, tech… (pas un RPM plat $1.50–$5).
- **Multiplicateur géo** — FR/US/etc. pour des estimations AdSense plus réalistes.
- **Studio Cash** — scan → niches cash → chaînes qui monétisent → pipeline favoris → export CSV/JSON (brief studio).
- **Plan éditorial** — calendrier auto + briefs titres/thumbnails à partir des **outliers** des chaînes du pipeline.
- **Rapport d’audit client** — HTML imprimable → PDF (niches cash, chaînes, outliers, calendrier, briefs + disclaimer).
- **YPP / efficacité $** — proxies sur l’analyse de chaînes.

Les chiffres AdSense sont des **ordres de grandeur** (benchmarks industrie), pas des garanties.

## Fonctionnalités

| Onglet | Rôle |
|--------|------|
| **Studio Cash** | Workflow monétisation + pipeline + plan éditorial |
| Niches | Sous-niches + Cash Score |
| Tendances | Vidéos à plus forte vélocité |
| Chaînes | Stats, AdSense estimé, compare jusqu’à 3 |
| Mots-clés | Difficulté + overall score + cash |
| **Optimize** | SEO score, tags, titres, desc, audit vidéo (style vidIQ) |
| **Scorecard** | Comparaison concurrents (jusqu’à 4) |
| **Idées** | Daily ideas + topic tracker local |
| **Rankings** | Historique keywords (Supabase, optionnel) |
| Outliers | Vidéos breakout d’une chaîne |

Aussi : i18n **FR/EN**, thème clair/sombre, historique, favoris, cache TTL par endpoint, export CSV/JSON, onboarding clé API.

## Live

- Landing : https://fredericnjoh-lab.github.io/nichescope/
- App studio : https://fredericnjoh-lab.github.io/nichescope/app.html

## Lancer en local

```bash
python3 -m http.server 8080
# → http://localhost:8080/          (landing)
# → http://localhost:8080/app.html  (studio)
```

(Les modules ES nécessitent un serveur HTTP — pas de `file://`.)

### Branding + Calendly

Dans l’app → **⚙** : nom, email, URL Calendly. Appliqué à la landing et aux PDF d’audit.

## Tests

```bash
npm test
```

## Clé API YouTube (gratuite)

1. [Google Cloud Console](https://console.cloud.google.com/) → projet
2. **APIs & Services → Library** → YouTube Data API v3 → Enable
3. **Credentials** → Create API key
4. Coller en haut de NicheScope → Sauver

**10 000 unités/jour**. Search = 100, videos/channels/playlistItems = 1. Cache local (45 min–6 h selon l’endpoint).

## Déploiement Vercel

```bash
vercel --prod
```

Front 100 % statique. Backend rankings = Supabase (optionnel).

## Supabase (P3 Rankings)

1. Crée un projet sur [supabase.com](https://supabase.com)
2. **Authentication → Providers → Anonymous** → Enable
3. Installe le CLI puis lie le projet :

```bash
npx supabase login
npx supabase link --project-ref <ton-ref>
npx supabase db push
npx supabase functions deploy scan-keyword
```

4. Dans l’app → onglet **Rankings** → colle **Project URL** + **anon key** (Settings → API)
5. Ta clé YouTube reste dans le navigateur ; elle est envoyée à la Edge Function via `x-youtube-key` (quota utilisateur)

Tables : `tracked_keywords`, `ranking_snapshots` (RLS par `auth.uid()`).

### Cron quotidien

```bash
npx supabase functions deploy scan-daily
npx supabase secrets set YOUTUBE_API_KEY=xxxxx
npx supabase secrets set CRON_SECRET=$(openssl rand -hex 24)
```

Puis adapte et exécute `supabase/cron-setup.sql` dans le SQL Editor (06:00 UTC).

### Extension Chrome

```
chrome://extensions → Developer mode → Load unpacked → dossier extension/
```

Panel SEO flottant sur YouTube watch / Studio. Détails : `extension/README.md`.

## Architecture

```
app.html / index.html   UI
js/
  app.js                Entry
  backend.js            Client Supabase (rankings)
  money.js / seo.js …   Moteurs purs
  features/             Onglets
supabase/
  migrations/           Schéma rankings + RLS
  functions/scan-keyword/
tests/
```

## Privacy

Clés (YouTube + Supabase anon) dans `localStorage`. Aucun analytics tiers.  
Sans Supabase configuré, l’app reste 100 % navigateur → API YouTube.
