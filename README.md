# Bambang - AI Voice Assistant for BRImo

Bambang adalah asisten virtual berbasis *Artificial Intelligence* (AI) yang terintegrasi untuk memberikan pengalaman layanan perbankan yang interaktif, responsif, dan dinamis pada ekosistem **BRImo**. 

Proyek ini menggabungkan interaksi suara waktu-nyata (*real-time voice streaming*), antarmuka dinamis (*dynamic UI state*), dan pencarian semantik (*semantic search*) dengan dukungan sistem *Retrieval-Augmented Generation* (RAG) untuk memberikan informasi finansial secara presisi dari basis pengetahuan (*Knowledge Base*) Bank BRI.

---

## 🏗️ Arsitektur Sistem

Bambang dibangun menggunakan pendekatan pemrosesan suara secara langsung menggunakan API *Gemini Multimodal Live* yang diorkestrasikan oleh *backend* FastAPI, serta React di *frontend* untuk menangkap dan merender perubahan UI secara seketika (*event-driven*).

```mermaid
sequenceDiagram
    participant User
    participant Frontend (React/Next.js)
    participant Backend (FastAPI)
    participant Database (PostgreSQL + pgvector)
    participant Gemini Live API
    participant Azure OpenAI (Embeddings)

    %% Semantic Search Flow
    User->>Frontend (React/Next.js): Klik "Cari" dan ketik query
    Frontend (React/Next.js)->>Backend (FastAPI): GET /api/search?q="..."
    Backend (FastAPI)->>Azure OpenAI (Embeddings): Create Embedding Vector
    Azure OpenAI (Embeddings)-->>Backend (FastAPI): Vector Data
    Backend (FastAPI)->>Database (PostgreSQL + pgvector): Vector Similarity Search (Cosine Distance)
    Database (PostgreSQL + pgvector)-->>Backend (FastAPI): Dokumen Relevan
    Backend (FastAPI)-->>Frontend (React/Next.js): Hasil Pencarian (JSON)
    Frontend (React/Next.js)-->>User: Render Hasil di Dynamic Panel

    %% Voice Interaction Flow
    User->>Frontend (React/Next.js): Berbicara melalui Mic
    Frontend (React/Next.js)->>Backend (FastAPI): Stream Audio via WebSocket
    Backend (FastAPI)->>Backend (FastAPI): Deteksi VAD (Voice Activity Detection)
    Backend (FastAPI)->>Azure OpenAI (Embeddings): Buat Embedding Transkrip (untuk RAG)
    Backend (FastAPI)->>Database (PostgreSQL + pgvector): Tarik Konteks Knowledge Base
    Backend (FastAPI)->>Gemini Live API: Kirim Audio + RAG Context + Tool Definitions
    Gemini Live API-->>Backend (FastAPI): Respons Audio + Function Call (set_ui_state)
    Backend (FastAPI)-->>Frontend (React/Next.js): Stream Respons Audio + Pesan WebSocket State UI
    Frontend (React/Next.js)-->>User: Putar Suara Bambang & Update Dynamic UI Screen
```

## ✨ Fitur Utama

1. **Real-time Voice Conversation**: Berbicara langsung dengan Bambang tanpa hambatan layaknya panggilan telepon, didukung oleh sistem VAD (*Voice Activity Detection*) untuk mendeteksi kapan pengguna selesai bicara.
2. **Context-Aware RAG (Retrieval-Augmented Generation)**: Bambang tidak menjawab sembarangan. Setiap kueri disuntikkan (*injected*) dengan informasi riil dari *database* BRI sehingga jawaban yang diberikan akurat sesuai panduan operasional.
3. **Dynamic UI Rendering**: Bambang dapat mengontrol layar *smartphone* Anda. Saat Bambang menjelaskan produk, layar akan menampilkan kartu detail produk. Saat ia menjelaskan FAQ, layar akan menampilkan langkah-langkah panduan.
4. **Semantic Search Panel**: Pencarian pintar menggunakan *vector database*. Tidak perlu kata kunci sama persis; pengguna dapat mencari dengan bahasa alami (contoh: "atm hilang") dan sistem akan memunculkan "Cara Blokir Kartu ATM".
5. **Fluid Glassmorphism UI**: Antarmuka modern yang memanjakan mata, mengadopsi elemen *liquid glass* dan warna-warna pastel untuk estetika premium khas perbankan modern.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js (App Router), React 18
- **Styling**: Tailwind CSS v4, Vanilla CSS (*Glassmorphism Design System*)
- **Animation**: Framer Motion
- **Icons**: Lucide React
- **Audio Processing**: Web Audio API, *silero-vad* (onnxruntime-web)

### Backend
- **Framework**: FastAPI, Uvicorn, WebSockets
- **AI/LLM**: Google Gemini 2.0 Flash (Multimodal Live API) via `google-genai` SDK
- **Embeddings**: Azure OpenAI (`text-embedding-3-small`)
- **Database ORM**: SQLAlchemy

### Database
- **Engine**: PostgreSQL
- **Extension**: `pgvector` (Vector Similarity Search)

---

## 🚀 Instalasi & Persiapan (*Setup*)

### 1. Prasyarat (*Prerequisites*)
Pastikan sistem Anda telah menginstal:
- Node.js (Versi 22 direkomendasikan)
- Python (Versi 3.11 atau lebih baru)
- PostgreSQL dengan ekstensi `pgvector` aktif.

### 2. Konfigurasi Backend

Masuk ke direktori `backend` dan buat *virtual environment*:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Salin file `.env.example` menjadi `.env` dan isi kredensial berikut:
```env
# Database PostgreSQL dengan dukungan Vector
DATABASE_URL="postgresql://user:password@localhost/dbname"

# Gemini Multimodal Live API
GEMINI_API_KEY="AIzaSyYourGeminiKey..."

# Azure OpenAI Embeddings (Untuk RAG Semantic Search)
EMBEDDING_PROVIDER="azure"
EMBEDDING_MODEL="text-embedding-3-small"
EMBEDDING_API_KEY="YourAzureKey..."
EMBEDDING_ENDPOINT="https://your-resource.openai.azure.com/openai/deployments/text-embedding-3-small"
```

Jalankan *server* FastAPI:
```bash
python -u app.py
```
*Backend* akan berjalan pada `http://localhost:8000`.

### 3. Konfigurasi Frontend

Buka terminal baru, masuk ke direktori `frontend`:
```bash
cd frontend
nvm use 22
npm install
```

Jalankan server pengembangan (*Development Server*):
```bash
npm run dev
```
*Frontend* akan berjalan pada `http://localhost:3000`.

---

## 📖 Cara Penggunaan (*Usage*)

1. Buka browser dan navigasi ke `http://localhost:3000`.
2. Anda akan disuguhkan *Dynamic Panel* interaktif.
3. **Mulai Percakapan Suara**: Tekan tombol bergambar *Microphone* berbentuk Orb di bagian tengah. Berikan izin penggunaan *microphone* jika diminta browser.
4. Mulai berbicara ("Halo Bambang, apa saja produk tabungan BRI?").
5. Tunggu sejenak, Bambang akan merespons melalui suara, dan *Dynamic Panel* secara ajaib akan memunculkan informasi visual yang relevan (*Product Cards* / *FAQ Steps*).
6. **Pencarian Cepat**: Klik menu **Cari** di navigasi bawah untuk mencoba fitur *Semantic Search* dan klik salah satu saran instan.
