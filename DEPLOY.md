# Deploying to a Google Cloud VM

Architecture: a single Compute Engine VM runs 4 containers via Docker Compose.

```
Browser ──HTTPS──> Caddy (:443) ──┬── /api/*, /ws/*, /health ──> backend  (FastAPI :8000) ──> db (pgvector)
                                  └── everything else ────────> frontend (Next.js :3000)
```

Caddy handles the HTTPS certificate automatically (Let's Encrypt). HTTPS is required because
browsers only allow microphone access on secure origins.

## 1. Reserve a static IP

Console → **VPC network → IP addresses → Reserve external static IP address**
- Name: `bri-voice-ip`, Region: `asia-southeast2` (Jakarta)

Note the IP, for example `34.101.12.34`. Our free domain becomes `34-101-12-34.sslip.io`
(replace the dots with dashes).

## 2. Create the VM

Console → **Compute Engine → VM instances → Create instance**
- Name: `bri-voice`
- Region: `asia-southeast2`, Zone: any
- Machine type: **e2-medium** (2 vCPU, 4 GB)
- Boot disk: **Ubuntu 24.04 LTS**, size **30 GB**
- Networking → External IPv4: select `bri-voice-ip`
- Firewall: tick **Allow HTTP traffic** and **Allow HTTPS traffic**

## 3. Install Docker on the VM

Click the **SSH** button in the VM list, then:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
```

Open SSH again (so the `docker` group takes effect) and check with `docker ps`.

## 4. Get the code

```bash
git clone https://github.com/erickalwd/bambang-voice-aibuildercup.git app
cd app
```

## 5. Set the environment

```bash
# Domain for Caddy (replace with your IP)
echo "DOMAIN=34-101-12-34.sslip.io" > .env

# Backend configuration
cp backend/.env.example backend/.env
nano backend/.env
```

Fill in `backend/.env` (embeddings also use Gemini, so a single API key is enough):

```
GEMINI_API_KEY=...

POSTGRES_USER=bri_admin
POSTGRES_PASSWORD=<replace-with-a-strong-password>
POSTGRES_DB=bri_knowledge
```

`POSTGRES_HOST`/`POSTGRES_PORT` do not need to change; compose points them at the `db` container automatically.

`POSTGRES_PASSWORD` **must be set** (it cannot be empty); if it is empty, the database container refuses to start.

## 6. Run

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The first build takes about 5 minutes. Then load the knowledge base (once only):

```bash
docker compose -f docker-compose.prod.yml exec backend python ingest.py
```

Open `https://34-101-12-34.sslip.io`.

## Everyday commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f backend

# Update after pushing new code
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Stop all containers
docker compose -f docker-compose.prod.yml down
```

## Cost tips (free trial)

- Set up a **budget alert** under Billing → Budgets & alerts (for example $50).
- When not in use, **Stop** the VM from the console. Only the disk and the static IP are still billed (very little).
- After the VM is started again, the containers come back up automatically (`restart: unless-stopped`).

## Troubleshooting

- **HTTPS fails / certificate error**: make sure ports 80 & 443 are open (HTTP/HTTPS firewall boxes ticked)
  and `DOMAIN` in `.env` matches the IP. Check `docker compose -f docker-compose.prod.yml logs caddy`.
- **Microphone cannot be accessed**: make sure you open the site via `https://`, not `http://` or the bare IP.
- **`dependency failed to start: container ... db-1 is unhealthy`**: `POSTGRES_PASSWORD` in `backend/.env` is empty.
  Set a password, then run `docker compose -f docker-compose.prod.yml down -v` and `up` again.
- **Search returns nothing**: re-run `ingest.py` and check the backend logs.
