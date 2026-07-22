# NicheScope × Supabase

Backend optionnel pour l’historique de rankings keywords.

## Setup rapide

1. Créer un projet Supabase
2. Activer **Anonymous sign-ins** (Auth → Providers)
3. Depuis la racine du repo :

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase functions deploy scan-keyword
```

4. Dans NicheScope → Rankings → URL + anon key

## Secrets (optionnel)

Si tu veux un fallback serveur (sans clé user) :

```bash
npx supabase secrets set YOUTUBE_API_KEY=xxxxx
```

Sinon le client envoie `x-youtube-key` (recommandé).
