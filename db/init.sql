-- Runs automatically the FIRST time the pgdata volume is created.
-- To re-run: docker compose down -v && docker compose up -d

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    source      TEXT,
    content     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    chunk_count INT  NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
    id          SERIAL PRIMARY KEY,
    document_id INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content     TEXT NOT NULL,
    embedding   VECTOR(384),
    tsv         TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);

CREATE TABLE IF NOT EXISTS customers (
    id          SERIAL PRIMARY KEY,
    external_id TEXT UNIQUE,
    name        TEXT,
    email       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
    id            SERIAL PRIMARY KEY,
    customer_id   INT REFERENCES customers(id) ON DELETE SET NULL,
    thread_id     TEXT,
    subject       TEXT,
    body          TEXT,
    intent        TEXT,
    urgency       TEXT,
    status        TEXT NOT NULL DEFAULT 'new',
    assigned_to   TEXT,
    sla_breached  BOOLEAN DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS memories (
    id          SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    content     TEXT NOT NULL,
    embedding   VECTOR(384),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    id          SERIAL PRIMARY KEY,
    order_id    TEXT NOT NULL UNIQUE,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    product     TEXT NOT NULL,
    amount      NUMERIC(10,2) NOT NULL,
    status      TEXT NOT NULL DEFAULT 'processing',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refunds (
    id         SERIAL PRIMARY KEY,
    order_id   TEXT NOT NULL UNIQUE,
    amount     NUMERIC(10,2) NOT NULL,
    reason     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_credits (
    id          SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount      NUMERIC(10,2) NOT NULL,
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS internal_notes (
    id          SERIAL PRIMARY KEY,
    ticket_id   INT REFERENCES tickets(id) ON DELETE CASCADE,
    customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
    note        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails_sent (
    id          SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
    subject     TEXT NOT NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals (
    id          SERIAL PRIMARY KEY,
    thread_id   TEXT NOT NULL,
    customer_id INT,
    action      TEXT NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'user',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    customer_id     INT REFERENCES customers(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw   ON chunks   USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_tsv_gin          ON chunks   USING gin  (tsv);
CREATE INDEX IF NOT EXISTS memories_embedding_hnsw ON memories USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS memories_customer_idx   ON memories (customer_id);
CREATE INDEX IF NOT EXISTS approvals_status_idx    ON approvals (status);
CREATE INDEX IF NOT EXISTS approvals_thread_idx    ON approvals (thread_id);

-- ============================================================
-- Seed data
-- Customers are inserted first; everything else links to them
-- by looking up external_id, so no integer IDs are hardcoded.
-- ============================================================

INSERT INTO customers (external_id, name, email)
VALUES
    ('cust_001', 'Tejas Tatode', 'tejas@example.com'),
    ('cust_002', 'Aisha Khan',   'aisha@example.com'),
    ('cust_003', 'Marcus Lee',   'marcus@example.com')
ON CONFLICT (external_id) DO NOTHING;

INSERT INTO orders (order_id, customer_id, product, amount, status)
VALUES
    ('ORD-123', (SELECT id FROM customers WHERE external_id = 'cust_001'), 'Wireless Headphones', 2999.00, 'shipped'),
    ('ORD-456', (SELECT id FROM customers WHERE external_id = 'cust_001'), 'Phone Case',           499.00, 'delivered'),
    ('ORD-789', (SELECT id FROM customers WHERE external_id = 'cust_002'), 'Laptop Stand',        1299.00, 'processing'),
    ('ORD-999', (SELECT id FROM customers WHERE external_id = 'cust_003'), 'Bluetooth Speaker',   1999.00, 'delivered')
ON CONFLICT (order_id) DO NOTHING;

INSERT INTO tickets (customer_id, thread_id, subject, body, status)
VALUES
    ((SELECT id FROM customers WHERE external_id = 'cust_001'), 'thread-001',
     'Headphones stopped working', 'My wireless headphones died after a week. I would like a refund.', 'new'),
    ((SELECT id FROM customers WHERE external_id = 'cust_002'), 'thread-002',
     'Where is my laptop stand?',  'Order ORD-789 still says processing after 10 days.',               'new'),
    ((SELECT id FROM customers WHERE external_id = 'cust_003'), 'thread-003',
     'Speaker is great',           'Just wanted to say the bluetooth speaker is excellent.',           'new');

INSERT INTO approvals (thread_id, customer_id, action, payload, status)
VALUES
    ('thread-001',
     (SELECT id FROM customers WHERE external_id = 'cust_001'),
     'refund',
     '{"order_id": "ORD-123", "amount": 2999.00, "reason": "defective product"}',
     'pending');