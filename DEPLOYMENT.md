# Deployment

How `reimbursement-v2` ships from `main` → `https://reimbursement.thehfhotel.org`.

## Topology

```
GitHub Actions (ubuntu-latest)
    │
    │ 1. build api+web → push to ghcr.io
    │
    │ 2. ssh to evergreen via cloudflared (Cloudflare Access service token)
    │
    ▼
evergreen (Ubuntu)
  ├── deploy user        — owns ~/reimbursement-v2-production/, in docker group
  │     └── ~/reimbursement-v2-production/{docker-compose.yml, .env}
  │
  ├── docker daemon
  │     ├── reimbursement-v2-postgres   (private network only)
  │     ├── reimbursement-v2-api        (private network only)
  │     └── reimbursement-v2-web        (private + shared-nginx network)
  │
  └── shared-nginx                       (host operator's existing container)
        └── proxy_pass http://reimbursement-v2-web;
              ▲
              │ reimbursement.thehfhotel.org
              │
        Cloudflare Tunnel → public internet
```

## Repo secrets (Settings → Secrets and variables → Actions)

| Secret | Purpose |
|---|---|
| `SSH_PRIVATE_KEY` | ed25519 private key for `deploy@evergreen` |
| `SSH_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 evergreen.thehfhotel.org` |
| `CF_ACCESS_CLIENT_ID` | Cloudflare Access service token id |
| `CF_ACCESS_CLIENT_SECRET` | Cloudflare Access service token secret |
| `JWT_SECRET` | App JWT signing key — `openssl rand -base64 48` |
| `LINE_CHANNEL_ID` | LINE Login channel id (shared with fingerprint-time-logger: `2007782520`) |
| `LINE_CHANNEL_SECRET` | LINE Login channel secret |
| `POSTGRES_PASSWORD` | Strong DB password — `openssl rand -base64 32` |

## First-time setup

### 1. Create the deploy SSH key (on your laptop)

```bash
ssh-keygen -t ed25519 -N '' -f ~/.ssh/reimbursement-v2-deploy \
  -C 'gh-actions deploy@reimbursement-v2'

cat ~/.ssh/reimbursement-v2-deploy.pub   # → goes to evergreen (next step)
cat ~/.ssh/reimbursement-v2-deploy       # → goes into SSH_PRIVATE_KEY secret
```

### 2. Provision the deploy user on evergreen

Copy `deploy/evergreen-setup.sh` to evergreen, then run as root:

```bash
scp deploy/evergreen-setup.sh evergreen:/tmp/
ssh evergreen
sudo DEPLOY_SSH_PUBKEY='ssh-ed25519 AAAA… gh-actions deploy@reimbursement-v2' \
  bash /tmp/evergreen-setup.sh
```

The script is idempotent — re-run it any time you need to add a second
authorized key or recreate the app directory.

### 3. Pin the host key

```bash
ssh-keyscan -t ed25519 evergreen.thehfhotel.org > /tmp/evergreen-known-host
cat /tmp/evergreen-known-host   # paste into the SSH_KNOWN_HOSTS GitHub secret
```

### 4. Cloudflare Access service token

In the Cloudflare Zero Trust dashboard:

1. **Access → Service Auth → Service Tokens** → *Create Service Token*. Name
   it `gh-actions-reimbursement-v2`. Save `Client ID` and `Client Secret`
   (the secret is shown once).
2. **Access → Applications** → open the SSH application that fronts
   `evergreen.thehfhotel.org` (the one your laptop already uses). Add a
   policy:
   - **Action**: `Service Auth`
   - **Include**: `Service Token` → `gh-actions-reimbursement-v2`
3. Drop both values into GitHub secrets as `CF_ACCESS_CLIENT_ID` and
   `CF_ACCESS_CLIENT_SECRET`.

### 5. LINE Developers console — register the new redirect URIs

The channel is shared with `fingerprint-time-logger` (channel id
`2007782520`). Add these callback URLs:

- `http://localhost:5173/auth/line/callback` (local dev)
- `https://reimbursement.thehfhotel.org/auth/line/callback` (prod)

### 6. DNS

Point `reimbursement.thehfhotel.org` at the existing Cloudflare Tunnel that
fronts evergreen — same way the rest of the fleet is exposed.

### 7. First-deploy nginx vhost

The deploy user can't write to the host operator's `~/nginx`. As the
operator, **once**:

```bash
# On evergreen, as the user that owns the shared-nginx config (e.g. nut)
curl -fsSL https://raw.githubusercontent.com/thehfhotel/reimbursement-v2/main/deploy/nginx/reimbursement.conf \
  -o ~/nginx/sites-available/reimbursement.conf
ln -sf ~/nginx/sites-available/reimbursement.conf ~/nginx/sites-enabled/reimbursement.conf

docker exec shared-nginx nginx -t   # validate
docker exec shared-nginx nginx -s reload
```

Subsequent deploys don't change the vhost (the `proxy_pass` target is the
stable container name `reimbursement-v2-web`).

### 8. Trigger the first deploy

```bash
git push origin main
```

Watch the run at <https://github.com/thehfhotel/reimbursement-v2/actions>.

## Day-2 operations

### Manual migration

The api container's entrypoint runs `prisma migrate deploy` on boot. To
apply schema changes outside of a deploy:

```bash
ssh evergreen 'docker exec reimbursement-v2-api bunx prisma migrate deploy'
```

### Inspect prod data

```bash
ssh evergreen 'docker exec -it reimbursement-v2-postgres psql -U postgres -d reimbursement'
```

### Rollback

Each deploy pins `IMAGE_TAG=sha-<commit>` in `~/reimbursement-v2-production/.env`
on evergreen. To roll back, edit that file, change `IMAGE_TAG=` to the
previous sha, then:

```bash
ssh evergreen <<'SH'
cd ~/reimbursement-v2-production
docker compose pull
docker compose up -d --remove-orphans
SH
```

### Logs

```bash
ssh evergreen 'docker logs --tail=200 -f reimbursement-v2-api'
ssh evergreen 'docker logs --tail=200 -f reimbursement-v2-web'
ssh evergreen 'docker logs --tail=200 -f reimbursement-v2-postgres'
```

### Backups

```bash
ssh evergreen <<'SH'
ts=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p ~/backups/reimbursement-v2
docker run --rm \
  -v reimbursement_v2_postgres_data:/data:ro \
  -v ~/backups/reimbursement-v2:/out \
  alpine tar -czf /out/postgres-${ts}.tar.gz -C /data .
docker run --rm \
  -v reimbursement_v2_uploads_data:/data:ro \
  -v ~/backups/reimbursement-v2:/out \
  alpine tar -czf /out/uploads-${ts}.tar.gz -C /data .
SH
```

Wire into cron / systemd-timer on evergreen for automatic snapshots.

## Why this shape

- **GH-hosted runner + SSH** instead of a self-hosted runner: no long-lived
  agent on evergreen, no daemon to keep updated, blast radius of a
  compromised workflow run is "what `deploy@evergreen` can do inside the
  docker socket" — not host-level.
- **Cloudflare Access service token** instead of opening SSH to the
  internet: zero net-new attack surface. Same Access policy that lets your
  laptop in lets the workflow in.
- **Pinned host key**: protects against an evil cloudflared / man-in-tunnel
  swapping the host.
- **`umask 077` + `chmod 600` on `.env`**: secrets never have a
  world-readable window on either the runner or evergreen.
- **Image tags pinned by sha** on the deploy host: rollback is "edit one
  line, `docker compose up -d`" — no need to re-run a workflow.
- **No host port for the api**: api is reachable only via the web
  container's nginx, which is reachable only via shared-nginx, which is
  fronted by Cloudflare. Three layers between the public internet and the
  api process.
