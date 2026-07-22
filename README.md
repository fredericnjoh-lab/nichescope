# NicheScope Studio

Outil gratuit (100 % navigateur) pour trouver des **niches YouTube qui monétisent** — et construire ton propre pipeline de studio.

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

Pas de backend, pas de variables d’env.

## Architecture

```
index.html          UI + onglets
style.css           Thème + Studio
js/
  app.js            Entry
  money.js          Moteur Cash / RPM
  api.js            YouTube + cache + quota
  i18n.js           FR / EN
  features/         studio, niche, channel…
tests/money.test.js
```

## Privacy

Clé API dans `localStorage` uniquement. Aucun analytics. Appels uniquement vers l’API YouTube.
