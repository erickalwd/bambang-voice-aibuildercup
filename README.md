# Bambang - AI Voice Assistant for BRImo

Bambang is an Artificial Intelligence (AI) virtual assistant built to deliver an interactive, responsive, and dynamic banking service experience within the **BRImo** ecosystem.

The project combines real-time voice streaming, a dynamic UI state, and semantic search, backed by a Retrieval-Augmented Generation (RAG) system that provides precise financial information from Bank BRI's knowledge base.

---

## ✨ Key Features

1. **Real-time Voice Conversation**: Talk to Bambang directly, as smoothly as a phone call, supported by VAD (Voice Activity Detection) to detect when the user has finished speaking.
2. **Context-Aware RAG (Retrieval-Augmented Generation)**: Bambang does not answer at random. Every query is injected with real information from BRI's database, so the answers are accurate and follow operational guidelines.
3. **Dynamic UI Rendering**: Bambang can control your smartphone screen. When Bambang explains a product, the screen shows product detail cards. When it explains an FAQ, the screen shows the step-by-step guide.
4. **Semantic Search Panel**: Smart search powered by a vector database. No exact keywords needed; users can search in natural language (for example "atm hilang", "lost ATM card") and the system brings up "Cara Blokir Kartu ATM" ("How to Block an ATM Card").
5. **Fluid Glassmorphism UI**: A modern, easy-on-the-eyes interface that adopts liquid glass elements and pastel colors for the premium look of modern banking.

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
- **AI/LLM**: Google Gemini 2.0 Flash (Multimodal Live API) via the `google-genai` SDK
- **Embeddings**: Azure OpenAI (`text-embedding-3-small`)
- **Database ORM**: SQLAlchemy

### Database
- **Engine**: PostgreSQL
- **Extension**: `pgvector` (Vector Similarity Search)

---

## 🚀 Installation & Setup

### 1. Prerequisites
Make sure your system has the following installed:
- Node.js (version 22 recommended)
- Python (version 3.11 or newer)
- PostgreSQL with the `pgvector` extension enabled.

### 2. Backend Configuration

Go to the `backend` directory and create a virtual environment:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in the following credentials:
```env
# PostgreSQL database with vector support
DATABASE_URL="postgresql://user:password@localhost/dbname"

# Gemini Multimodal Live API
GEMINI_API_KEY="AIzaSyYourGeminiKey..."

# Azure OpenAI Embeddings (for RAG semantic search)
EMBEDDING_PROVIDER="azure"
EMBEDDING_MODEL="text-embedding-3-small"
EMBEDDING_API_KEY="YourAzureKey..."
EMBEDDING_ENDPOINT="https://your-resource.openai.azure.com/openai/deployments/text-embedding-3-small"
```

Start the FastAPI server:
```bash
python -u app.py
```
The backend runs at `http://localhost:8000`.

### 3. Frontend Configuration

Open a new terminal and go to the `frontend` directory:
```bash
cd frontend
nvm use 22
npm install
```

Start the development server:
```bash
npm run dev
```
The frontend runs at `http://localhost:3000`.

---

## 📖 Usage

1. Open a browser and navigate to `http://localhost:3000`.
2. You will see the interactive *Dynamic Panel*.
3. **Start a voice conversation**: Tap the microphone button in the center of the screen. Allow microphone access if the browser asks.
4. Start talking ("Halo Bambang, apa saja produk tabungan BRI?" / "Hi Bambang, what savings products does BRI offer?").
5. After a moment, Bambang responds by voice, and the *Dynamic Panel* brings up the relevant visual information (*Product Cards* / *FAQ Steps*).
6. **Quick search**: Tap **Cari** (Search) in the bottom navigation to try *Semantic Search*, then tap one of the instant suggestions.
