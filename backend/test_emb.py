import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
emb_client = OpenAI(
    api_key=os.getenv("EMBEDDING_API_KEY"),
    base_url=os.getenv("EMBEDDING_ENDPOINT"),
    default_headers={"api-key": os.getenv("EMBEDDING_API_KEY")},
    default_query={"api-version": "2023-05-15"}
)

try:
    res = emb_client.embeddings.create(input="test", model=os.getenv("EMBEDDING_MODEL"))
    print("SUCCESS")
except Exception as e:
    print(f"FAILED: {e}")
