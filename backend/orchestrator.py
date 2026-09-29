import os
import json
import asyncio
import traceback
import base64
from typing import Dict, Any
from dotenv import load_dotenv

# RAG DB
from rag_manager import SessionLocal, KnowledgeItem
from embeddings import embed_query

# Google GenAI SDK
from google import genai
from google.genai import types

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Per-language additions to the system prompt and the opening greeting.
# The base instructions stay in Indonesian; the directive below controls
# the language Bambang speaks and the text it sends to the UI.
LANGUAGE_PROFILES = {
    "id": {
        "directive": """
[BAHASA]
Selalu berbicara dan menjawab dalam Bahasa Indonesia. Semua teks `title` dan `desc` yang Anda kirim lewat tool `set_ui_state` juga WAJIB dalam Bahasa Indonesia.""",
        "greeting": "Halo! Tolong sapa saya dengan ramah dan lengkap, perkenalkan dirimu sebagai Bambang dari Bank BRI, dan tanyakan apa yang bisa dibantu hari ini.",
    },
    "en": {
        "directive": """
[LANGUAGE — OVERRIDES EVERYTHING ABOVE]
The customer has chosen ENGLISH. Always speak and respond in natural, fluent English, even though these instructions and the knowledge base are written in Indonesian — translate the knowledge base content when you answer.
- Every `title` and `desc` you send through `set_ui_state` MUST be written in English. Keep official product names as they are (BritAma, Simpedes, BRImo, KUR, etc.).
- In the fraud-alert case, say in English: "For your security, I have temporarily frozen your outgoing transactions. Please stay calm..." Never say you are unable to block it.
- When asking for fraud confirmation, ask in English: "Have you already clicked the link or shared your OTP or password?"
- Address the customer as "Sir/Madam" instead of "Bapak/Ibu".
- If the customer switches to Indonesian, you may follow them, but default to English.""",
        "greeting": "Hello! Please greet me warmly in English, introduce yourself as Bambang, the virtual assistant from Bank BRI, and ask how you can help me today.",
    },
}

class AudioOrchestrator:
    def __init__(self):
        self.sessions: Dict[str, Any] = {}
        self.genai_client = genai.Client(api_key=GEMINI_API_KEY)
        print("Initialized Gemini Live API Orchestrator (Native Audio RAG)")

    async def start_session(self, websocket, lang: str = "id") -> str:
        session_id = "sess_" + os.urandom(4).hex()
        self.sessions[session_id] = {
            "client_ws": websocket,
            "lang": lang if lang in LANGUAGE_PROFILES else "id",
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
                        "state": {"type": "STRING", "description": "Pilih 'products' (daftar produk), 'lead_form' (form pendaftaran), 'idle' (pusat), 'faq_steps' (penjelasan langkah/informasi), atau 'fraud_alert' (peringatan penipuan)."},
                        "data": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "title": {"type": "STRING", "description": "Judul (misal: nama produk atau nama langkah)"},
                                    "desc": {"type": "STRING", "description": "Penjelasan detail"}
                                }
                            },
                            "description": "WAJIB DIISI! Daftar data yang akan ditampilkan. Jika state='faq_steps', isi dengan langkah-langkah. Jika state='products', isi dengan daftar produk yang ditanyakan (contoh: BritAma, Simpedes)."
                        }
                    },
                    "required": ["state", "data"]
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
ANDA WAJIB MEMANGGIL TOOL `set_ui_state` SETIAP KALI ANDA MENYEBUTKAN PRODUK ATAU LANGKAH-LANGKAH.
1. Jika pengguna bertanya/Anda menjelaskan varian produk (misal BritAma, Simpedes), WAJIB panggil tool `set_ui_state` dengan state="products" dan isi array `data` dengan rincian produk (title dan desc).
2. Jika pengguna setuju untuk mendaftar kartu kredit/produk, panggil tool `set_ui_state` dengan state="lead_form" dan data kosong.
3. Jika Anda menjelaskan panduan, daftar informasi, tata cara, atau syarat (misal cara blokir, lupa password), WAJIB panggil tool `set_ui_state` dengan state="faq_steps" dan sediakan array `data` (berisi title dan desc tiap langkah/poin).
JIKA ANDA TIDAK MEMANGGIL TOOL INI, PENGGUNA TIDAK BISA MELIHAT LAYAR DENGAN BENAR!
4. Jika Anda sedang di halaman form dan pengguna menyebutkan nama, nomor HP, atau email mereka, panggil tool `fill_form_field` untuk mengisi form tersebut secara otomatis.
5. Gunakan `search_knowledge_base` jika Anda ditanya tentang detail produk Bank BRI.
6. [SANGAT PENTING - FRAUD ALERT] 
   - JANGAN langsung memblokir jika pengguna baru bercerita. LAKUKAN KONFIRMASI DULU! Tanyakan dengan tenang: "Apakah Bapak/Ibu sudah terlanjur mengklik link tersebut atau memberikan kode OTP/Password?"
   - HANYA JIKA nasabah mengonfirmasi "Iya saya sudah klik" atau "Iya saya sudah kasih OTP" ATAU mereka sangat panik karena sedang dipandu penipu: SEGERA panggil tool `set_ui_state` dengan state="fraud_alert". 
   - KETIKA Anda memanggil state="fraud_alert", ANDA WAJIB secara verbal mengatakan: "Baik Bapak/Ibu, demi keamanan, saat ini saya telah membantu membekukan transaksi keluar Anda untuk sementara waktu. Harap tenang..." JANGAN PERNAH MENGATAKAN "Saya tidak bisa memblokir", karena Anda bertindak sebagai sistem AI yang bisa mengendalikan aplikasi."""
            lang_profile = LANGUAGE_PROFILES[session["lang"]]
            system_instruction_text += "\n" + lang_profile["directive"]
            print(f"Session {session_id} language: {session['lang']}")

            config = types.LiveConnectConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name="Puck"
                        )
                    )
                ),
                system_instruction=types.Content(parts=[types.Part.from_text(text=system_instruction_text)]),
                tools=[{"function_declarations": [search_kb_tool, set_ui_state_tool, fill_form_field_tool]}]
            )
            
            async with self.genai_client.aio.live.connect(model="gemini-3.1-flash-live-preview", config=config) as gemini_session:
                session["gemini_session"] = gemini_session
                print(f"Gemini Live Session connected for {session_id}")
                
                # Send Initial Greeting
                # We instruct Gemini to give a longer, formal greeting as Bambang.
                await gemini_session.send(input=lang_profile["greeting"], end_of_turn=True)
                
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
                            # Lets the client know no more audio will arrive for this turn.
                            await client_ws.send_text(json.dumps({"type": "turn_complete"}))
                    
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
                                    query_emb = embed_query(query)
                                    db = SessionLocal()
                                    results = db.query(KnowledgeItem).filter(KnowledgeItem.lang == session["lang"]).order_by(KnowledgeItem.embedding.cosine_distance(query_emb)).limit(3).all()
                                    context_text = "\n\n".join([f"{r.title}:\n{r.content}" for r in results])
                                    db.close()
                                    if not context_text.strip():
                                        context_text = "Tidak ada hasil."
                                except Exception as e:
                                    context_text = "Error saat pencarian DB: " + str(e)
                                    
                                hint = "\n\n[SANGAT PENTING: Jika konteks di atas berisi langkah-langkah, WAJIB segera panggil tool `set_ui_state` dengan state='faq_steps' dan isi array `data` (title & desc). Jika berisi varian produk, gunakan state='products'. PANGGIL TOOL INI BERSAMAAN DENGAN JAWABAN ANDA!]"
                                context_text += hint
                                
                                responses.append({
                                    "id": call_id,
                                    "name": name,
                                    "response": {"result": context_text}
                                })
                                
                            elif name == "set_ui_state":
                                print(f">>>>> DEBUG TOOL CALL: set_ui_state with args: {args}")
                                state = args.get("state", "idle")
                                data_payload = args.get("data", [])
                                await client_ws.send_text(json.dumps({
                                    "type": "ui_update",
                                    "ui_state": state,
                                    "data": data_payload
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
