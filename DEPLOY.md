# Deploy ke Google Cloud VM

Arsitektur: satu VM Compute Engine menjalankan 4 container via Docker Compose.

```
Browser ──HTTPS──> Caddy (:443) ──┬── /api/*, /ws/*, /health ──> backend  (FastAPI :8000) ──> db (pgvector)
                                  └── selain itu ─────────────> frontend (Next.js :3000)
```

Caddy otomatis mengurus sertifikat HTTPS (Let's Encrypt). HTTPS wajib karena browser
hanya mengizinkan akses mikrofon di origin yang aman.

## 1. Reservasi IP statis

Console → **VPC network → IP addresses → Reserve external static IP address**
- Name: `bri-voice-ip`, Region: `asia-southeast2` (Jakarta)

Catat IP-nya, misalnya `34.101.12.34`. Domain gratis kita jadi `34-101-12-34.sslip.io`
(ganti titik dengan tanda strip).

## 2. Buat VM

Console → **Compute Engine → VM instances → Create instance**
- Name: `bri-voice`
- Region: `asia-southeast2`, Zone: bebas
- Machine type: **e2-medium** (2 vCPU, 4 GB)
- Boot disk: **Ubuntu 24.04 LTS**, ukuran **30 GB**
- Networking → External IPv4: pilih `bri-voice-ip`
- Firewall: centang **Allow HTTP traffic** dan **Allow HTTPS traffic**

## 3. Install Docker di VM

Klik tombol **SSH** di daftar VM, lalu:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
```

Buka SSH lagi (agar grup `docker` aktif), cek dengan `docker ps`.

## 4. Ambil kode

```bash
git clone https://github.com/erickalwd/bambang-voice-assistant.git app
cd app
git checkout feature/bri-redesign-bilingual   # atau main, sesuai branch yang di-push
```

Repo private? Gunakan Personal Access Token GitHub sebagai password saat diminta.

## 5. Isi environment

```bash
# Domain untuk Caddy (ganti dengan IP Anda)
echo "DOMAIN=34-101-12-34.sslip.io" > .env

# Konfigurasi backend
cp backend/.env.example backend/.env
nano backend/.env
```

Isi `backend/.env` dengan variabel yang sama seperti di lokal:

```
GEMINI_API_KEY=...
EMBEDDING_PROVIDER=...
EMBEDDING_MODEL=...
EMBEDDING_ENDPOINT=...
EMBEDDING_API_KEY=...

POSTGRES_USER=bri_admin
POSTGRES_PASSWORD=<ganti-dengan-password-kuat>
POSTGRES_DB=bri_knowledge
```

`POSTGRES_HOST`/`POSTGRES_PORT` tidak perlu diubah; compose otomatis mengarahkannya ke container `db`.

## 6. Jalankan

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Build pertama makan waktu ~5 menit. Lalu isi knowledge base (sekali saja):

```bash
docker compose -f docker-compose.prod.yml exec backend python ingest.py
```

Buka `https://34-101-12-34.sslip.io`.

## Perintah sehari-hari

```bash
# Lihat log
docker compose -f docker-compose.prod.yml logs -f backend

# Update setelah push kode baru
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Matikan semua container
docker compose -f docker-compose.prod.yml down
```

## Tips biaya (free trial)

- Pasang **budget alert** di Billing → Budgets & alerts (misalnya $50).
- Saat tidak dipakai, **Stop** VM dari console. Yang tetap ditagih hanya disk dan IP statis (sangat kecil).
- Setelah VM di-start lagi, container otomatis jalan kembali (`restart: unless-stopped`).

## Troubleshooting

- **HTTPS gagal / sertifikat error**: pastikan port 80 & 443 terbuka (firewall HTTP/HTTPS dicentang)
  dan `DOMAIN` di `.env` sesuai IP. Cek `docker compose -f docker-compose.prod.yml logs caddy`.
- **Mikrofon tidak bisa diakses**: pastikan membuka lewat `https://`, bukan `http://` atau IP langsung.
- **Pencarian kosong**: jalankan ulang `ingest.py` dan cek log backend.
