CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding VECTOR(384),
  tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS documents_tsv_idx ON documents USING GIN (tsv);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_id TEXT UNIQUE,
  customer_id TEXT,
  status TEXT,
  amount NUMERIC,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS episodic_memory (
  id SERIAL PRIMARY KEY,
  customer_id TEXT,
  turn TEXT,
  embedding VECTOR(384),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS semantic_memory (
  id SERIAL PRIMARY KEY,
  customer_id TEXT,
  fact TEXT,
  embedding VECTOR(384),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'agent'
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti TEXT PRIMARY KEY,
  revoked_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  customer_id TEXT,
  subject TEXT,
  status TEXT DEFAULT 'open',
  sla_due_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
