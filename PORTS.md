# Ports

| Port | Service | Where |
|---|---|---|
| 5173 | Frontend dev server (Vite) | local dev |
| 3001 | API dev server (Bun + Elysia) | local dev |
| 5433 | Postgres dev | local dev (Docker, mapped from 5432) |
| 80 / 443 | shared-nginx (Cloudflare-fronted) | evergreen prod |
| 5432 | Postgres prod | inside `reimbursement_internal` Docker network — no host binding |

## Production routing

Public traffic hits `shared-nginx` on the evergreen host. The vhost
`reimbursement.thehfhotel.org` proxies to the `reimbursement-web` container,
which runs an internal nginx that serves the SPA build and proxies `/api/*`
and `/uploads/*` to the `api` container on port 3001 over a private Docker
network.

## Why 5433 in dev

The host's port 5432 is reserved for other Postgres instances on the same
machine. We use 5433 to avoid collision. Update `DATABASE_URL` in `.env` if
you change it.

## Changing the dev frontend port

```bash
bun run dev:web -- --port 5174
```

If you change it, also update `LINE_REDIRECT_URI` in `.env` and add the new
URL to the LINE Developers console.
