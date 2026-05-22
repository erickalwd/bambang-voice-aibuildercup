from google import genai
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")
api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key, http_options={'api_version': 'v1alpha'})
for m in client.models.list():
    if "flash" in m.name and "audio" in m.name:
        print(m.name)
    elif "flash" in m.name and "3" in m.name:
        print(m.name)
    elif "3.1" in m.name:
        print(m.name)
