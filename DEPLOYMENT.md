# Reimbursement — Production Deployment

This repo deploys to the **evergreen** Ubuntu host
(`evergreen.thehfhotel.org`) at https://reimbursement.thehfhotel.org via the
fleet's standard GitHub Actions pattern: GHCR images + a self-hosted runner +
the host-level `shared-nginx` reverse proxy.

## What gets shipped

Two images, built by `.github/workflows/deploy.yml` on every push to `main`:

- `ghcr.io/thehfhotel/reimbursement-api:latest` (and `:sha-<short>`)
  Bun + Elysia + Prisma server, listens on `:3001` inside its container.
- `ghcr.io/thehfhotel/reimbursement-web:latest` (and `:sha-<short>`)
  Vite SPA served from `nginx:alpine`, with `/api/` and `/uploads/`
  reverse-proxied to the api container.

Plus one stateful service in the production compose:

- `postgres:16-alpine` — internal-only, no host port mapping. Data lives in
  the named volume `reimbursement_postgres_data`.

## Topology

```
Cloudflare Tunnel → evergreen :80 → shared-nginx
                                    │  vhost: reimbursement.thehfhotel.org
                                    ▼
                              reimbursement-web (nginx:alpine)
                                    │  /api/, /uploads/  →  api:3001
                                    ▼
                              reimbursement-api (bun)
                                    │  prisma  →  postgres:5432
                                    ▼
                              reimbursement-postgres
```

The api container is **not** attached to the `shared-nginx` network — only
the web container is. That means the api is reachable only through the web
container's reverse proxy.

## What the workflow does

1. **build** (on `ubuntu-latest`):
   - Logs in to GHCR with `${{ secrets.GITHUB_TOKEN }}`.
   - Builds and pushes both images with cache-from/cache-to via GitHub
     Actions cache.
2. **deploy** (on `[self-hosted, deploy]`, runs on evergreen itself):
   - Sparse-checkouts only `docker-compose.production.yml` and
     `deploy/nginx/reimbursement.conf`.
   - Writes `~/reimbursement-production/.env` from GitHub Secrets (file
     mode 600).
   - `docker compose pull` then `docker compose up -d --remove-orphans`.
   - Idempotently installs the `shared-nginx` vhost into
     `~/nginx/sites-available/reimbursement.conf` and symlinks it into
     `sites-enabled`. Reloads `shared-nginx` only if the file changed.
   - Probes `reimbursement-api`'s `/health` endpoint and then probes
     end-to-end through shared-nginx.

## GitHub Secrets you must set

These power the `Materialize .env from secrets` step. Set them under
**Settings → Secrets and variables → Actions** on the repo:

| Secret name           | What it is                                                      |
| --------------------- | --------------------------------------------------------------- |
| `JWT_SECRET`          | 32+ char random string. `openssl rand -base64 48` works.        |
| `LINE_CHANNEL_ID`     | LINE Login channel ID (numeric).                                |
| `LINE_CHANNEL_SECRET` | LINE Login channel secret.                                      |
| `POSTGRES_PASSWORD`   | Password for the `postgres` superuser inside the prod database. |

Static (non-secret) values that are baked into the workflow's `.env` writer:
`POSTGRES_USER=postgres`, `POSTGRES_DB=reimbursement`, `NODE_ENV=production`,
`LINE_REDIRECT_URI=https://reimbursement.thehfhotel.org/auth/line/callback`,
`WEB_BASE_URL=https://reimbursement.thehfhotel.org`.

## First-time setup

These are one-time manual steps, separate from the workflow:

1. **DNS**: `reimbursement.thehfhotel.org` must resolve to the Cloudflare
   Tunnel that fronts evergreen. Verify with
   `dig reimbursement.thehfhotel.org`.
2. **LINE Developers Console**: add the production callback URL
   `https://reimbursement.thehfhotel.org/auth/line/callback` to the LINE
   Login channel. Without this LINE will reject the OAuth handshake with
   `invalid_request: redirect_uri does not match`.
3. **GitHub Secrets**: set the four secrets in the table above.
4. **First push to `main`** triggers the build + deploy. The workflow drops
   the nginx vhost in place and reloads `shared-nginx` automatically.

## Where logs live

```bash
# Application + nginx (web container) logs
docker logs reimbursement-api
docker logs reimbursement-web
docker logs reimbursement-postgres

# Host-level shared-nginx access/error logs for this vhost
docker exec shared-nginx tail -f /var/log/nginx/reimbursement-access.log
docker exec shared-nginx tail -f /var/log/nginx/reimbursement-error.log
```

The deploy directory on evergreen is `~/reimbursement-production/`; it
holds only `docker-compose.yml` and `.env`, never source.

## Manual operations

### Run a Prisma migration by hand

The api container runs `prisma migrate deploy` on every start
(`apps/api/docker-entrypoint.sh`). If you ever need to invoke it manually:

```bash
docker exec reimbursement-api bunx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

# Or if you want the db push escape hatch (dev-style sync, no migration files):
docker exec reimbursement-api bunx prisma db push --schema=apps/api/prisma/schema.prisma
```

To open an interactive psql against the prod database (postgres has no host
port mapping in production):

```bash
docker exec -it reimbursement-postgres psql -U postgres -d reimbursement
```

### Roll back to a previous build

Every build pushes a `:sha-<short>` tag in addition to `:latest`. To roll
back, edit `~/reimbursement-production/.env` on evergreen and set
`IMAGE_TAG=sha-<short>` to the SHA you want, then:

```bash
cd ~/reimbursement-production
docker compose pull
docker compose up -d
```

To restore the rolling pointer once the issue is fixed, set
`IMAGE_TAG=latest` (or just delete the line, since the compose default is
`latest`) and re-run the deploy workflow.

### Backups

`postgres_data` is the only stateful Docker volume that matters. A simple
nightly dump:

```bash
docker exec reimbursement-postgres pg_dump -U postgres reimbursement \
    | gzip > ~/backups/reimbursement-$(date +%F).sql.gz
```

`uploads_data` (receipt photos, transfer screenshots) should also be backed
up — it's a docker volume, so `docker run --rm -v reimbursement_uploads_data:/v -v $PWD:/out alpine tar czf /out/uploads-$(date +%F).tar.gz -C /v .`
is enough for an offsite copy.

## Rolling back the nginx vhost

The deploy job writes the vhost only when its content changes, so simply
reverting the change in `deploy/nginx/reimbursement.conf` and pushing to
`main` will re-emit the file. To take the vhost down entirely without a
deploy:

```bash
ssh evergreen "rm ~/nginx/sites-enabled/reimbursement.conf && docker exec shared-nginx nginx -s reload"
```

## Troubleshooting

- **502 from the edge** — usually the api container is unhealthy or not on
  the `reimbursement_internal` network. `docker compose ps` and
  `docker logs reimbursement-api`.
- **`prisma migrate deploy` fails on startup** — schema drift. The
  entrypoint exits non-zero, so the api container won't serve traffic.
  Inspect with `docker logs reimbursement-api` and either ship the missing
  migration or run `prisma migrate resolve` against the prod DB.
- **LINE login redirects to `invalid_request`** — `LINE_REDIRECT_URI` in
  the LINE Developers Console must exactly match the value baked into
  `.env`. Re-add the callback URL on the LINE side, no redeploy needed.
