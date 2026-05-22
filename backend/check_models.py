from google import genai
import os
from dotenv import load_dotenv

load_dotenv()
client = genai.Client()
models = client.models.list()
for m in models:
    if "live" in m.name or "audio" in m.name or "flash" in m.name:
        print(m.name)
