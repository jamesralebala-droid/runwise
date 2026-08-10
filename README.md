# RunWise

Cross-border delivery and errand marketplace for Botswana and Southern Africa.

## Apps

- **Marketing site** — pre-launch homepage (`index.html`) with all CTAs to `early-access.html`.
- **Web app** — Vite + React shell (`app/index.html`, `src/`) that mounts the RunWise SPA, served at `/app`. Runtime scripts live in `public/`.
- **Admin portal** — `admin/` (separate Vite + React app, built into `dist/admin/`).
- **Mobile** — `mobile/` (Expo React Native, Android-first).
- **Backend** — Supabase: schema/functions in `supabase/`, migrations in `supabase/migrations/`, edge functions in `supabase/functions/`.

## Develop

```bash
bun install
bun run dev      # web app
cd admin && npm install && npm run dev   # admin portal
```

## Build & deploy

```bash
bun run build    # builds web app + admin into dist/
```

See `README-SETUP.md` for the Supabase setup and `TESTING-CHECKLIST.md` for the end-to-end test walkthrough.
