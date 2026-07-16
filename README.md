# Shopping Site + Local RAG Recommendations

A small shopping site (users, products, orders) with a RAG-based "recommended for you" feature powered entirely by a local LLM — no cloud API keys required.

```
order history → profile vector (avg of purchased product embeddings) → pgvector similarity search, excl. purchased → local LLM → recommendation message + product grid
```

## Stack

| Layer | Tech |
|---|---|
| DB | Postgres + `pgvector` (Docker) |
| Backend | Node.js + Express, plain SQL via `pg` |
| Frontend | React + Vite |
| Embeddings | Ollama, `nomic-embed-text` (768-dim) |
| Generation | Ollama, `llama3.2` |

Everything runs locally. The only external dependency is [Ollama](https://ollama.com) running on the host.

## Project layout

```
db/init.sql              schema: users, products (+ embedding col), orders, order_items
docker-compose.yml        Postgres + pgvector
backend/src/
  server.js               Express app entrypoint
  db.js                   pg connection pool
  routes/                 users, products, orders, recommendations
  seed.js                 full reset: 150 users, 1000 products, ~1300 orders (category-biased)
  reseedOrders.js         reset users/orders only, mixed categories per user (keeps embeddings)
  embedding.js            Ollama embeddings helper
  embedProducts.js        one-off: embeds every product missing an embedding
  recommend.js            profile vector, retrieval, LLM generation + validation
frontend/src/
  App.jsx                 routes + cart/user state
  pages/                  ProductList, Cart, Orders, Recommendation
RECOMMENDATION-SYSTEM.md   step-by-step build guide for the recommendation piece
```

## Prerequisites

- Docker
- Node.js 22+
- [Ollama](https://ollama.com) running locally, with:
  ```bash
  ollama pull nomic-embed-text
  ollama pull llama3.2
  ```

## Setup

**1. Database**
```bash
docker compose up -d
```
Runs Postgres on `localhost:5433` (not 5432, to avoid clashing with other local Postgres instances) with the `pgvector` extension and schema from `db/init.sql`.

**2. Backend**
```bash
cd backend
cp .env.example .env
npm install
npm run seed              # 150 users, 1000 products, ~1300 orders
node src/embedProducts.js # embeds all products via Ollama (one-off, ~a few minutes)
npm run dev                # API on :8001
```

**3. Frontend**
```bash
cd frontend
npm install
npm run dev                # UI on :5173, proxies /api to :8001
```

Open `http://localhost:5173`. Switch users in the navbar, browse/filter products, add to cart, check out, view order history, and check **For You** for the per-user recommendation.

## Useful scripts

| Command | What it does |
|---|---|
| `npm run seed` (backend) | Full reset — wipes and regenerates users, products, orders. Re-embed after running this. |
| `node src/reseedOrders.js` (backend) | Resets only users/orders/order_items with mixed-category purchase history. Leaves products and their embeddings untouched — no re-embedding needed. |
| `node src/embedProducts.js` (backend) | Embeds any product with a `NULL` embedding. Safe to re-run. |

## How the recommendation works

- No search box — a user's **order history is the query**. Their purchased products' embeddings are averaged into a "profile vector."
- Retrieval (`pgvector`, cosine distance) finds the closest unpurchased products to that vector.
- The local LLM writes a short recommendation message from those candidates.
- **The product grid shown in the UI is the full retrieved candidate list**, not whatever subset the model happened to mention — local models are inconsistent about citation count (sometimes 1 product, sometimes nearly all of them), so display is decoupled from the message text.
- New users with no order history fall back to trending (most-ordered) products.
- The model's output is validated, not trusted: any `product_id` it invents that isn't in the candidate list is filtered out, with a deterministic fallback message if nothing survives validation.

See `RECOMMENDATION-SYSTEM.md` for the full step-by-step build.

## Ports

| Service | Port |
|---|---|
| Postgres | 5433 |
| Backend API | 8001 |
| Frontend (Vite) | 5173 |
| Ollama | 11434 (default) |
