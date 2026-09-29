import json
import os
import sys
from dotenv import load_dotenv
from rag_manager import init_db, SessionLocal, KnowledgeItem
from sqlalchemy.orm import Session
from embeddings import embed_document

load_dotenv()

def ingest_data(reset: bool = False):
    init_db()
    db: Session = SessionLocal()

    # Embeddings from a different model are not comparable, so re-embed everything.
    if reset:
        deleted = db.query(KnowledgeItem).delete()
        db.commit()
        print(f"Reset: deleted {deleted} existing items.")
    
    with open("knowledge_base.json", "r") as f:
        data = json.load(f)
        
    for item in data:
        # Check if exists
        existing = db.query(KnowledgeItem).filter(KnowledgeItem.id == item["id"]).first()
        if existing:
            print(f"Skipping {item['id']}, already exists.")
            continue
            
        print(f"Embedding {item['id']}...")
        emb = embed_document(item["title"] + "\n" + item["content"])
        
        db_item = KnowledgeItem(
            id=item["id"],
            category=item["category"],
            lang=item.get("lang", "id"),
            title=item["title"],
            content=item["content"],
            embedding=emb
        )
        db.add(db_item)
        
    db.commit()
    db.close()
    print("Ingestion complete!")

if __name__ == "__main__":
    ingest_data(reset="--reset" in sys.argv)
