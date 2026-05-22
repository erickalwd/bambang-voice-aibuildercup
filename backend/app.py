import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from orchestrator import AudioOrchestrator

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
