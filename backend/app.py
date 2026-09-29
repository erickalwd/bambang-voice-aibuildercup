import asyncio
import time
import traceback
from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from orchestrator import AudioOrchestrator
from embeddings import embed_query
from rag_manager import SessionLocal, KnowledgeItem
from sqlalchemy.sql.expression import func
from dotenv import load_dotenv
import limits

load_dotenv()

app = FastAPI(title="BRI Voice Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=limits.ALLOWED_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)

orchestrator = AudioOrchestrator()
search_limiter = limits.RateLimiter(limits.SEARCH_PER_MINUTE)
suggestions_limiter = limits.RateLimiter(limits.SUGGESTIONS_PER_MINUTE)
voice_sessions = limits.SessionCounter()

MAX_QUERY_LENGTH = 200


def client_ip(conn: Request | WebSocket) -> str:
    # uvicorn runs with --proxy-headers, so this is the real client IP behind Caddy.
    return conn.client.host if conn.client else "unknown"


def rate_limited():
    return JSONResponse({"error": "rate_limited"}, status_code=429)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/suggestions")
def get_suggestions(request: Request, lang: str = "id"):
    if not suggestions_limiter.allow(client_ip(request)):
        return rate_limited()
    db = SessionLocal()
    try:
        # Get 5 random knowledge items
        results = db.query(KnowledgeItem).filter(KnowledgeItem.lang == lang).order_by(func.random()).limit(5).all()
        return {"suggestions": [r.title for r in results]}
    except Exception:
        traceback.print_exc()
        return JSONResponse({"error": "internal_error"}, status_code=500)
    finally:
        db.close()


@app.get("/api/search")
def search_knowledge(request: Request, q: str, lang: str = "id"):
    if not search_limiter.allow(client_ip(request)):
        return rate_limited()
    db = SessionLocal()
    try:
        query_emb = embed_query(q[:MAX_QUERY_LENGTH])
        results = db.query(KnowledgeItem).filter(KnowledgeItem.lang == lang).order_by(KnowledgeItem.embedding.cosine_distance(query_emb)).limit(3).all()

        items = []
        for r in results:
            items.append({
                "title": r.title,
                "desc": r.content
            })
        return {"results": items}
    except Exception:
        traceback.print_exc()
        return JSONResponse({"error": "internal_error"}, status_code=500)
    finally:
        db.close()


@app.websocket("/ws/voice")
async def websocket_endpoint(websocket: WebSocket):
    if not limits.origin_allowed(websocket.headers.get("origin"), websocket.headers.get("host")):
        await websocket.close(code=1008)
        return

    await websocket.accept()
    ip = client_ip(websocket)
    refused = voice_sessions.try_acquire(ip)
    if refused:
        await websocket.send_json({"type": "error", "code": refused})
        await websocket.close(code=1013)
        return

    lang = websocket.query_params.get("lang", "id")
    session_id = await orchestrator.start_session(websocket, lang=lang)
    started = time.monotonic()
    try:
        # The orchestrator's background tasks own the socket; wait until they end the
        # session (client left or Gemini closed) or the time limit is reached.
        while orchestrator.is_active(session_id):
            if time.monotonic() - started > limits.MAX_SESSION_SECONDS:
                await websocket.send_json({"type": "error", "code": "session_timeout"})
                await websocket.close(code=1000)
                break
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        print("app.py: websocket_endpoint was CANCELLED (client disconnected or server shutdown).")
    except Exception as e:
        print(f"app.py: Websocket connection error: {e}")
    finally:
        await orchestrator.end_session(session_id)
        voice_sessions.release(ip)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
