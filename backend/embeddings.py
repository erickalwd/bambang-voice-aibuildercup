import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

# Gemini embeddings (free tier) truncated to 1536 dims to match the
# Vector(1536) column in rag_manager.KnowledgeItem.
EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
EMBEDDING_DIM = 1536

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def _embed(text: str, task_type: str) -> list[float]:
    res = _client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(task_type=task_type, output_dimensionality=EMBEDDING_DIM),
    )
    return res.embeddings[0].values


def embed_document(text: str) -> list[float]:
    return _embed(text, "RETRIEVAL_DOCUMENT")


def embed_query(text: str) -> list[float]:
    return _embed(text, "RETRIEVAL_QUERY")
