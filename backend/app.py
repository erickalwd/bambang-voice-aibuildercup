import json
import asyncio
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from orchestrator import AudioOrchestrator, emb_client, emb_model
from rag_manager import SessionLocal, KnowledgeItem
from sqlalchemy.sql.expression import func
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="BRI Voice Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = AudioOrchestrator()

@app.get("/health")
def health_check():
    return {"status": "ok"}



@app.get("/api/suggestions")
def get_suggestions():
    db = SessionLocal()
    try:
        # Get 5 random knowledge items
        results = db.query(KnowledgeItem).order_by(func.random()).limit(5).all()
        return {"suggestions": [r.title for r in results]}
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()

@app.get("/api/search")
def search_knowledge(q: str):
    db = SessionLocal()
    try:
        emb_res = emb_client.embeddings.create(input=q, model=emb_model)
        query_emb = emb_res.data[0].embedding
        results = db.query(KnowledgeItem).order_by(KnowledgeItem.embedding.cosine_distance(query_emb)).limit(3).all()
        
        items = []
        for r in results:
            items.append({
                "title": r.title,
                "desc": r.content
            })
        return {"results": items}
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()

@app.websocket("/ws/voice")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = await orchestrator.start_session(websocket)
    try:
        # Prevent app.py from closing the websocket, let the orchestrator background task run
        # Wait indefinitely until the client disconnects or backend closes it
        while True:
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        print("app.py: websocket_endpoint was CANCELLED (client disconnected or server shutdown).")
    except Exception as e:
        print(f"app.py: Websocket connection error: {e}")
    finally:
        await orchestrator.end_session(session_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
