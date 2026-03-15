# Deploy (home server only – Kubernetes)

These scripts are **only for the machine that runs production** (your home server). Do not run the cron job on your dev machine.

The app runs in a dedicated namespace `sarussiware`. Postgres runs in the same namespace and is used only by this app.

## First-time setup on the server (start here)

When you’re SSH’d into the home server, do this in order:

**1. Check prerequisites**

```bash
docker --version
kubectl cluster-info
envsubst --version   # if missing: apt install gettext  or  dnf install gettext
```

**2. Start a local registry** (if you don’t have one yet)

```bash
docker run -d -p 5000:5000 --restart=always --name registry registry:2
```

If your cluster can’t pull from `localhost:5000`, use the server’s LAN IP instead when setting `REGISTRY` (e.g. `REGISTRY=192.168.1.10:5000`). You may need to mark that registry as insecure in your cluster’s container runtime config.

**3. Clone the repo**

```bash
cd /path/where/you/want/repos
git clone <your-repo-url> SarussiWare
cd SarussiWare
```

**4. Create and edit the Postgres secret**

```bash
cp k8s/postgres-secret.yaml.example k8s/postgres-secret.yaml
nano k8s/postgres-secret.yaml   # set POSTGRES_PASSWORD and the same password in DATABASE_URL
```

**5. Run the first deploy**

```bash
export REGISTRY=localhost:5000   # or your server IP, e.g. 192.168.1.10:5000
./scripts/deploy-k8s.sh
```

**6. (Optional) Add cron for auto-deploy on push to main**

```bash
crontab -e
# Add this line (use the real path to the repo):
# */5 * * * * export REGISTRY=localhost:5000; /path/to/SarussiWare/scripts/poll-and-deploy.sh
```

After step 5, the app and Postgres are running. Open the app at **http://SERVER_LAN_IP:30080** from any device on the LAN (see “Connecting to the web app from the LAN” below).

---

## Prerequisites on the server

- Docker (for building images)
- `kubectl` configured for your cluster
- A container registry the cluster can pull from (see below)
- `envsubst` (usually in `gettext` package: `apt install gettext` or equivalent)

## Registry

The server builds the app image and pushes it to a registry. The cluster must be able to pull from that registry.

- **Single-node cluster:** Often you run a local registry, e.g. `docker run -d -p 5000:5000 --restart=always registry:2`. Then set `REGISTRY=localhost:5000` (or the node’s IP). Configure Docker/containerd so the cluster can pull from it (e.g. insecure registry).
- **Multi-node or remote registry:** Use a registry reachable by all nodes (e.g. a registry service in the cluster or a hostname all nodes can resolve). Set `REGISTRY` to that host and port.

Export `REGISTRY` in the shell that runs the deploy (or in cron), e.g.:

```bash
export REGISTRY=localhost:5000   # or your-registry.example.com:5000
```

## Secrets

`k8s/postgres-secret.yaml` is **not** in git (it’s in `.gitignore`). Before the first deploy on the server:

1. Copy the example and fill in real values:
   ```bash
   cp k8s/postgres-secret.yaml.example k8s/postgres-secret.yaml
   # Edit k8s/postgres-secret.yaml: set POSTGRES_PASSWORD and the same password in DATABASE_URL
   ```
2. `POSTGRES_PASSWORD` and the password inside `DATABASE_URL` must match.
3. `DATABASE_URL` must be `postgres://USER:PASSWORD@db:5432/DBNAME` (same namespace, so `db` is the Postgres service).

If you had already committed `k8s/postgres-secret.yaml`, stop tracking it (and change the password in the cluster if it was pushed):  
`git rm --cached k8s/postgres-secret.yaml`

## Connecting to the database from your dev machine (LAN)

Postgres is exposed on the server via NodePort **30432** so you can connect from another machine on the same LAN.

- **Host:** Your home server’s LAN IP (e.g. `192.168.1.10`).
- **Port:** `30432`.
- **User / password / database:** Same as in `k8s/postgres-secret.yaml` on the server (e.g. user `app`, db `appdb`).

From your dev machine, use that URL for Prisma or any Postgres client:

```bash
DATABASE_URL="postgres://app:YOUR_PASSWORD@SERVER_LAN_IP:30432/appdb"
```

Example with a separate env file (so you don’t overwrite your local DB):

```bash
# .env.remote (do not commit; add to .gitignore if you want)
DATABASE_URL=postgres://app:yourpassword@192.168.1.10:30432/appdb
```

Then run Prisma against the server DB, e.g.:

```bash
cd app && dotenv -e ../.env.remote -- npx prisma studio
# or: dotenv -e ../.env.remote -- npx prisma migrate deploy
```

**Keeping it LAN-only:** The NodePort is open on the server’s IP. To avoid exposing it to the internet, do not forward port 30432 on your router. Optionally, on the server you can restrict that port to your LAN subnet (e.g. with `iptables`/`nftables` or your firewall) so only 192.168.x.x can connect.

## Connecting to the web app from the LAN

The app is exposed on the server via NodePort **30080**. From any device on the same network (browser, phone, etc.) open:

**http://SERVER_LAN_IP:30080**

Example: if the server is `192.168.1.10`, use **http://192.168.1.10:30080**.

To avoid exposing it to the internet, do not forward port 30080 on your router.

## Cron

On the home server:

1. Clone the repo and set `REGISTRY` (e.g. in `~/.bashrc` or in the crontab).

2. Add a crontab entry (`crontab -e`):
   ```bash
   # Every 5 minutes: fetch and deploy if main changed
   */5 * * * * export REGISTRY=localhost:5000; /path/to/SarussiWare/scripts/poll-and-deploy.sh
   ```
   Use the real path to the repo and the same `REGISTRY` value your cluster uses.

Pushing to `main` will be picked up on the next cron run; the script only runs `deploy-k8s.sh` when `origin/main` has new commits.

## Manual deploy on the server

```bash
export REGISTRY=localhost:5000   # or your registry
./scripts/deploy-k8s.sh          # deploys main
./scripts/deploy-k8s.sh main     # same
```

## What the deploy script does

1. `git checkout main` and `git pull origin main`
2. Build Docker image from `./app`, tag with git SHA, push to `REGISTRY/sarussiware-web:TAG`
3. Apply namespace, Postgres (ConfigMap, Secret, StatefulSet, Service), app Service
4. Wait for Postgres to be ready
5. Run a one-off Job `migrate-<TAG>` (Prisma migrate deploy)
6. Apply app Deployment and wait for rollout

All of this runs in the repo root on the server; your local clone is unaffected.
