import json
import os
from openai import OpenAI
from dotenv import load_dotenv
from rag_manager import init_db, SessionLocal, KnowledgeItem
from sqlalchemy.orm import Session

load_dotenv()

emb_api_key = os.getenv("EMBEDDING_API_KEY")
emb_endpoint = os.getenv("EMBEDDING_ENDPOINT")
emb_model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
if emb_model.startswith('"') and emb_model.endswith('"'):
    emb_model = emb_model[1:-1]

from openai import OpenAI, AzureOpenAI
import re

def get_azure_params(endpoint, fallback_model):
    base_url_match = re.match(r"(https?://[^/]+)", endpoint) if endpoint else None
    base_url = base_url_match.group(1) if base_url_match else endpoint
    dep_match = re.search(r"/deployments/([^/]+)", endpoint) if endpoint else None
    dep_name = dep_match.group(1) if dep_match else fallback_model.split("/")[-1]
    return base_url, dep_name

if emb_endpoint and "azure" in emb_endpoint.lower():
    emb_base, emb_dep = get_azure_params(emb_endpoint, emb_model)
    openai_client = AzureOpenAI(api_key=emb_api_key, azure_endpoint=emb_base, api_version="2023-05-15", azure_deployment=emb_dep)
    emb_model = emb_dep
else:
    openai_client = OpenAI(
        api_key=emb_api_key,
        base_url=emb_endpoint if emb_endpoint else None
    )

def get_embedding(text: str) -> list[float]:
    response = openai_client.embeddings.create(
        input=text,
        model=emb_model
    )
    return response.data[0].embedding

def ingest_data():
    init_db()
    db: Session = SessionLocal()
    
    with open("knowledge_base.json", "r") as f:
        data = json.load(f)
        
    for item in data:
        # Check if exists
        existing = db.query(KnowledgeItem).filter(KnowledgeItem.id == item["id"]).first()
        if existing:
            print(f"Skipping {item['id']}, already exists.")
            continue
            
        print(f"Embedding {item['id']}...")
        emb = get_embedding(item["title"] + "\n" + item["content"])
        
        db_item = KnowledgeItem(
            id=item["id"],
            category=item["category"],
            title=item["title"],
            content=item["content"],
            embedding=emb
        )
        db.add(db_item)
        
    db.commit()
    db.close()
    print("Ingestion complete!")

if __name__ == "__main__":
    ingest_data()
