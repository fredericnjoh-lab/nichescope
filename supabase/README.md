# NicheScope × Supabase

Backend optionnel pour l’historique de rankings keywords + cron quotidien.

## Setup rapide

1. Créer un projet Supabase
2. Activer **Anonymous sign-ins** (Auth → Providers)
3. Depuis la racine du repo :

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase functions deploy scan-keyword
npx supabase functions deploy scan-daily
```

Si `db push` échoue, colle le SQL de `migrations/20260722100000_rankings.sql` dans le **SQL Editor**.

4. Dans NicheScope → Rankings → URL + anon key

## Secrets

```bash
# Requis pour le cron uniquement (scan-daily). scan-keyword n’utilise jamais cette clé.
npx supabase secrets set YOUTUBE_API_KEY=xxxxx
npx supabase secrets set CRON_SECRET=$(openssl rand -hex 24)
```

`scan-keyword` exige le header `x-youtube-key` (clé YouTube de l’utilisateur). Pas de fallback serveur.

## Cron quotidien (`scan-daily`)

1. Deploy la function (ci-dessus)
2. Remplace les placeholders dans `cron-setup.sql` :
   - `PROJECT_REF` → ex. `dmgqhebyybqflptqntul`
   - `YOUR_CRON_SECRET` → la valeur de `CRON_SECRET`
3. Colle dans SQL Editor → Run

Ou test manuel :

```bash
curl -X POST "https://PROJECT_REF.supabase.co/functions/v1/scan-daily" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -d '{"limit":10}'
```

Quota YouTube : ~100 unités / keyword (search). Limite défaut = 40 keywords/jour.

## Functions

| Function | Rôle |
|----------|------|
| `scan-keyword` | Scan 1 keyword (JWT user + `x-youtube-key`) |
| `scan-daily` | Batch cron (service role + `YOUTUBE_API_KEY` + `CRON_SECRET`) |
