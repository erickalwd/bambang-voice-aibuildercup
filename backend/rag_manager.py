import os
from sqlalchemy import create_engine, Column, String, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pgvector.sqlalchemy import Vector
from dotenv import load_dotenv

load_dotenv()

DB_USER = os.getenv("POSTGRES_USER", "bri_admin")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "bri_password")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "bri_knowledge")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class KnowledgeItem(Base):
    __tablename__ = "knowledge_base"
    
    id = Column(String, primary_key=True, index=True)
    category = Column(String, index=True)
    lang = Column(String, index=True, default="id", server_default="id")
    title = Column(String)
    content = Column(Text)
    # text-embedding-3-small uses 1536 dimensions
    embedding = Column(Vector(1536))

from sqlalchemy import text

def init_db():
    # Install pgvector extension if not exists
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    # Databases created before the lang column existed need it added in place.
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS lang VARCHAR DEFAULT 'id'"))
        conn.commit()
    print("Database initialized.")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
