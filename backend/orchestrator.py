import os
import json
import asyncio
import traceback
import base64
from typing import Dict, Any
from dotenv import load_dotenv

# RAG DB
from rag_manager import SessionLocal, KnowledgeItem
from openai import OpenAI

# Google GenAI SDK
from google import genai
from google.genai import types

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

emb_client = OpenAI(
    api_key=os.getenv("EMBEDDING_API_KEY"),
    base_url=os.getenv("EMBEDDING_ENDPOINT"),
    default_headers={"api-key": os.getenv("EMBEDDING_API_KEY")}
)
emb_model = os.getenv("EMBEDDING_MODEL")

class AudioOrchestrator:
    def __init__(self):
        self.sessions: Dict[str, Any] = {}
        self.genai_client = genai.Client(api_key=GEMINI_API_KEY)
        print("Initialized Gemini Live API Orchestrator (Native Audio RAG)")

    async def start_session(self, websocket) -> str:
        session_id = "sess_" + os.urandom(4).hex()
        self.sessions[session_id] = {
            "client_ws": websocket,
            "tasks": [],
            "gemini_session": None,
            "is_active": True
        }
        
        # Start the background task that manages the Gemini connection
        task = asyncio.create_task(self.run_gemini_session(session_id))
        self.sessions[session_id]["tasks"].append(task)
        
        return session_id

    async def run_gemini_session(self, session_id: str):
        print(f"--- run_gemini_session started for {session_id} ---")
        try:
            session = self.sessions.get(session_id)
            if not session: return
            client_ws = session["client_ws"]
            
            search_kb_tool = {
                "name": "search_knowledge_base",
                "description": "Cari informasi produk, layanan, atau FAQ dari database pengetahuan BRI.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "query": {"type": "STRING", "description": "Pertanyaan atau kata kunci pencarian"}
                    },
                    "required": ["query"]
                }
            }

            set_ui_state_tool = {
                "name": "set_ui_state",
                "description": "Ubah tampilan layar pengguna ke halaman tertentu.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "state": {"type": "STRING", "description": "Pilih 'products' (daftar produk), 'lead_form' (form pendaftaran), atau 'idle' (pusat informasi awal)"}
                    },
                    "required": ["state"]
                }
            }

            fill_form_field_tool = {
                "name": "fill_form_field",
                "description": "Isi data formulir pendaftaran di layar pengguna secara otomatis HANYA KETIKA pengguna menyebutkan data diri mereka.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "field": {"type": "STRING", "description": "Field yang diisi: 'name', 'phone', atau 'email'"},
                        "value": {"type": "STRING", "description": "Nilai data yang diekstrak"}
                    },
                    "required": ["field", "value"]
                }
            }

            system_instruction_text = """Anda adalah Bambang, asisten virtual suara Bank BRI. Jawab dengan ramah, hangat, namun profesional layaknya asisten bank. Jangan gunakan kalimat panjang. 
TUGAS PENTING ANDA TERKAIT TAMPILAN (UI):
1. Jika pengguna bertanya tentang produk atau Anda ingin menawarkan produk, panggil tool `set_ui_state` dengan state="products" agar layar pengguna berubah menampilkan daftar produk.
2. Jika pengguna setuju untuk mendaftar kartu kredit/produk, panggil tool `set_ui_state` dengan state="lead_form" agar form pendaftaran muncul.
3. Jika Anda sedang di halaman form dan pengguna menyebutkan nama, nomor HP, atau email mereka, panggil tool `fill_form_field` untuk mengisi form tersebut secara otomatis.
4. Gunakan `search_knowledge_base` jika Anda ditanya tentang detail produk Bank BRI."""
            config = types.LiveConnectConfig(
                response_modalities=["AUDIO"],
                system_instruction=types.Content(parts=[types.Part.from_text(text=system_instruction_text)]),
                tools=[{"function_declarations": [search_kb_tool, set_ui_state_tool, fill_form_field_tool]}]
            )
            
            async with self.genai_client.aio.live.connect(model="gemini-3.1-flash-live-preview", config=config) as gemini_session:
                session["gemini_session"] = gemini_session
                print(f"Gemini Live Session connected for {session_id}")
                
                # Send Initial Greeting
                # We just say "Halo!" so the bot responds naturally as Bambang.
                await gemini_session.send(input="Halo!", end_of_turn=True)
                
                t1 = asyncio.create_task(self.forward_client_to_gemini(session_id))
                t2 = asyncio.create_task(self.forward_gemini_to_client(session_id))
                
                session["tasks"].extend([t1, t2])
                
                await asyncio.gather(t1, t2, return_exceptions=True)
                print(f"Gather complete for {session_id}")
                
        except Exception as e:
            traceback.print_exc()
            print(f"FATAL Error in Gemini session: {repr(e)}")
            await self.end_session(session_id)

    async def forward_client_to_gemini(self, session_id: str):
        session = self.sessions.get(session_id)
        if not session: return
        client_ws = session["client_ws"]
        
        try:
            import wave
            wav_file = wave.open(f"debug_{session_id}.wav", "wb")
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(16000)
            chunk_count = 0

            while session.get("is_active"):
                data = await client_ws.receive_text()
                msg = json.loads(data)
                
                if msg.get("type") == "realtime_input":
                    if session.get("gemini_session"):
                        audio_bytes = base64.b64decode(msg["data"])
                        
                        if chunk_count < 20:
                            wav_file.writeframes(audio_bytes)
                            chunk_count += 1
                            if chunk_count == 20:
                                wav_file.close()
                                print(f"=== SAVED DEBUG WAV: debug_{session_id}.wav ===")
                                
                        await session["gemini_session"].send_realtime_input(audio=types.Blob(mime_type="audio/pcm;rate=16000", data=audio_bytes))
                elif msg.get("type") == "client_text":
                    if session.get("gemini_session"):
                        await session["gemini_session"].send(input=msg["data"], end_of_turn=True)
                elif msg.get("type") == "end_of_speech":
                    if session.get("gemini_session"):
                        print("Received end_of_speech from frontend. Forcing Gemini turn complete.")
                        await session["gemini_session"].send_client_content(turn_complete=True)
        except asyncio.CancelledError:
            print(f"forward_client_to_gemini CANCELLED for {session_id}")
        except Exception as e:
            print(f"Client disconnected with error: {e}")
            await self.end_session(session_id)

    async def forward_gemini_to_client(self, session_id: str):
        session = self.sessions.get(session_id)
        if not session: return
        client_ws = session["client_ws"]
        gemini_session = session["gemini_session"]
        
        try:
            while session.get("is_active"):
                async for response in gemini_session.receive():
                    if response.server_content:
                        # Model audio response
                        if response.server_content.model_turn:
                            for part in response.server_content.model_turn.parts:
                                if part.text:
                                    print(f"Sending bot_text to client: {part.text}")
                                    await client_ws.send_text(json.dumps({
                                        "type": "bot_text",
                                        "text": part.text
                                    }))
                                if part.inline_data and part.inline_data.data:
                                    print(f"Sending audio to client: {len(part.inline_data.data)} bytes")
                                    b64_audio = base64.b64encode(part.inline_data.data).decode('utf-8')
                                    await client_ws.send_text(json.dumps({
                                        "type": "audio",
                                        "data": b64_audio
                                    }))
                        # Interruption
                        if response.server_content.interrupted:
                            await client_ws.send_text(json.dumps({"type": "interrupt"}))
                        if response.server_content.turn_complete:
                            print("GEMINI SENT: turn_complete=True")
                    
                    if response.tool_call:
                        responses = []
                        for fc in response.tool_call.function_calls:
                            name = fc.name
                            args = fc.args
                            call_id = fc.id
                            
                            if name == "search_knowledge_base":
                                query = args.get("query", "")
                                print(f"Gemini RAG Query: {query}")
                                try:
                                    emb_res = emb_client.embeddings.create(input=query, model=emb_model)
                                    query_emb = emb_res.data[0].embedding
                                    db = SessionLocal()
                                    results = db.query(KnowledgeItem).order_by(KnowledgeItem.embedding.cosine_distance(query_emb)).limit(3).all()
                                    context_text = "\n\n".join([f"{r.title}:\n{r.content}" for r in results])
                                    db.close()
                                    if not context_text.strip():
                                        context_text = "Tidak ada hasil."
                                except Exception as e:
                                    context_text = "Error saat pencarian DB: " + str(e)
                                    
                                responses.append({
                                    "id": call_id,
                                    "name": name,
                                    "response": {"result": context_text}
                                })
                                
                            elif name == "set_ui_state":
                                state = args.get("state", "idle")
                                await client_ws.send_text(json.dumps({
                                    "type": "ui_update",
                                    "ui_state": state,
                                    "data": []
                                }))
                                responses.append({
                                    "id": call_id,
                                    "name": name,
                                    "response": {"result": "OK, UI updated to " + state}
                                })
                                
                            elif name == "fill_form_field":
                                field = args.get("field")
                                value = args.get("value")
                                await client_ws.send_text(json.dumps({
                                    "type": "form_fill",
                                    "field": field,
                                    "value": value
                                }))
                                responses.append({
                                    "id": call_id,
                                    "name": name,
                                    "response": {"result": "OK, Form field updated"}
                                })
                        
                        if responses:
                            await gemini_session.send(input=responses)
                            
                # If we broke out of the async for, just continue while is_active to restart iterator
                        
        except asyncio.CancelledError:
            print(f"forward_gemini_to_client CANCELLED for {session_id}")
        except Exception as e:
            traceback.print_exc()
            print(f"Gemini receive error: {e}")
            pass

    async def end_session(self, session_id: str):
        session = self.sessions.pop(session_id, None)
        if session:
            session["is_active"] = False
            for t in session.get("tasks", []):
                t.cancel()
