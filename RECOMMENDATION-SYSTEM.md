# Adding RAG Recommendations — Local LLM, On-Demand

Wires a RAG recommendation system into the existing `users` / `products` / `orders` / `order_items` schema. Fully local — no cloud API keys, no external calls. Computed on-demand per request, not precomputed/cached.

```
order_items/orders → profile vector (avg of purchased product embeddings) → pgvector search, excl. purchased → local LLM → { message, product_ids }
```

There's no search box — a user's own order history is the query.

**Stack (already installed and running via Ollama on this machine):**

- Embeddings: `nomic-embed-text` (768-dim)
- Generation: `llama3.2`

Check what you have: `ollama list`. Any embedding-capable model works for embeddings, any tool/chat-capable model works for generation — swap the model names below if you'd rather use `qwen2.5:7b` etc.

---

## Step 1 — Env config (no API keys needed)

`backend/.env` and `.env.example`:

```
OLLAMA_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
GENERATION_MODEL=llama3.2
```

No new npm packages — call Ollama's REST API with the built-in `fetch` (Node 22+).

---

## Step 2 — Schema: vector column dimension must match your embedding model

`nomic-embed-text` outputs 768-dim vectors — the current schema has `embedding VECTOR(1024)` (sized for a different model). Update `db/init.sql`:

```sql
embedding VECTOR(768), -- must match your embedding model's output dimension
```

And add an HNSW index for it:

```sql
CREATE INDEX ON products USING hnsw (embedding vector_cosine_ops);
```

Since the column is currently all `NULL`, this is a safe change to apply to the already-running DB:

```bash
docker exec -i recommendation-systems-db-1 psql -U shop -d shop -c "ALTER TABLE products ALTER COLUMN embedding TYPE vector(768);"
docker exec -i recommendation-systems-db-1 psql -U shop -d shop -c "CREATE INDEX ON products USING hnsw (embedding vector_cosine_ops);"
```

**No `recommendations` cache table this time** — the message is generated fresh on each API call, not precomputed by a batch job.

---

## Step 3 — Embeddings helper (Ollama)

`backend/src/embeddings.js`:

```js
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";

// nomic-embed-text distinguishes documents from queries via a task prefix,
// not an input_type param like Voyage/OpenAI -- same idea, different mechanism.
function withPrefix(text, inputType) {
  const prefix = inputType === "query" ? "search_query: " : "search_document: ";
  return `${prefix}${text}`;
}

export async function embedTexts(texts, inputType) {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.map((t) => withPrefix(t, inputType)),
    }),
  });
  if (!res.ok) throw new Error(`ollama embed failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.embeddings;
}
```

---

## Step 4 — Embed the catalog (one-off script)

`backend/src/embedProducts.js` — same shape as the cloud version, just calling the local helper:

```js
import { pool } from "./db.js";
import { embedTexts } from "./embeddings.js";

const BATCH_SIZE = 50;

async function embedProducts() {
  const { rows: products } = await pool.query(
    "SELECT id, title, description FROM products WHERE embedding IS NULL"
  );
  console.log(`${products.length} products need embeddings`);

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const texts = batch.map((p) => `${p.title}. ${p.description}`);
    const embeddings = await embedTexts(texts, "document");

    for (let j = 0; j < batch.length; j++) {
      await pool.query("UPDATE products SET embedding = $1::vector WHERE id = $2", [
        JSON.stringify(embeddings[j]),
        batch[j].id,
      ]);
    }
    console.log(`embedded ${Math.min(i + BATCH_SIZE, products.length)}/${products.length}`);
  }
  await pool.end();
}

embedProducts().catch((err) => { console.error(err); process.exit(1); });
```

Run once, and again whenever products change: `node src/embedProducts.js`. With 1000 products and a small local model, expect low single-digit minutes.

---

## Step 5 — Profile vector + retrieval

`backend/src/recommend.js` (part 1) — identical logic to the cloud version, no provider-specific code here:

```js
import { pool } from "./db.js";

export async function getUserProfileVector(userId) {
  const { rows } = await pool.query(
    `SELECT p.embedding
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE o.user_id = $1 AND p.embedding IS NOT NULL
     ORDER BY o.created_at DESC
     LIMIT 50`,
    [userId]
  );
  if (!rows.length) return null; // cold start

  const vectors = rows.map((r) => JSON.parse(r.embedding));
  const dim = vectors[0].length;
  const mean = new Array(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) mean[i] += v[i] / vectors.length;
  return mean;
}

export async function retrieveForUser(userId, profileVector, k = 20) {
  const { rows } = await pool.query(
    `SELECT id, title, description, category, price
     FROM products
     WHERE embedding IS NOT NULL
       AND id NOT IN (
         SELECT oi.product_id FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.user_id = $1
       )
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [userId, JSON.stringify(profileVector), k]
  );
  return rows;
}

export async function trendingProducts(k = 20) {
  const { rows } = await pool.query(
    `SELECT p.id, p.title, p.description, p.category, p.price, COUNT(*) AS order_count
     FROM order_items oi JOIN products p ON p.id = oi.product_id
     GROUP BY p.id ORDER BY order_count DESC LIMIT $1`,
    [k]
  );
  return rows;
}
```

`trendingProducts` is the cold-start fallback for users with no order history.

---

## Step 6 — Generate the message — and validate it

This is the part that's genuinely different from a hosted frontier model, not just a different API call.

**A 3B–7B local model is meaningfully worse than Claude at "only recommend from the candidates I gave you."** Tested directly against this exact prompt: `qwen2.5:7b` returned a `product_ids` array containing an id that didn't exist in the candidate list — a fabricated product, invented outright. `llama3.2` kept the ids valid but described a plausible-sounding product title in the prose that wasn't in the candidate list either. Lower temperature and a more explicit prompt reduced this substantially but did not reliably eliminate it in testing.

**Treat model output as untrusted, not as ground truth.** The mitigation:

1. Strengthen the prompt: repeat "copy titles exactly," "never invent," restate that `product_ids` must be a subset of the given ids.
2. Set `temperature` low (`0.1`) — less creative embellishment.
3. **Validate `product_ids` in code** — filter to the intersection with the actual candidate ids. Never trust the model's array as-is.
4. **Have a deterministic fallback** — if validation leaves nothing usable (empty array, malformed JSON), fall back to a plain code-generated message. This guarantees a hallucinated product can never reach the user, even if the model misbehaves.

```js
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const GENERATION_MODEL = process.env.GENERATION_MODEL || "llama3.2";

const SYSTEM_PROMPT = `You write ONE short recommendation message (1-2 sentences) shown at \
the top of a page for a returning customer.

Hard rules:
- Use ONLY the products listed in the candidates. Copy their titles exactly as given, character for character.
- Never mention, describe, or invent any product, title, or item that is not in the candidate list.
- "product_ids" in your JSON output must be a subset of the candidate ids -- never invent an id.
- No generic filler like "check out our great deals".`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    product_ids: { type: "array", items: { type: "integer" } },
  },
  required: ["message", "product_ids"],
  additionalProperties: false,
};

function fallbackMessage(candidates) {
  const top = candidates[0];
  return {
    message: `Based on your past purchases, you might like ${top.title}.`,
    product_ids: [top.id],
  };
}

export async function generateRecommendationMessage(candidates) {
  const candidatesBlock = candidates
    .map((c) => `${c.id} | ${c.title}: ${c.description}`)
    .join("\n");

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GENERATION_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Candidate products (id | title: description):\n${candidatesBlock}\n\nWrite the recommendation message using only these products.`,
        },
      ],
      format: OUTPUT_SCHEMA, // Ollama's structured-output param, same idea as Claude's output_config.format
      options: { temperature: 0.1 },
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`ollama chat failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  let parsed;
  try {
    parsed = JSON.parse(data.message.content);
  } catch {
    return fallbackMessage(candidates);
  }

  const validIds = new Set(candidates.map((c) => c.id));
  const productIds = (parsed.product_ids || []).filter((id) => validIds.has(id));

  if (!parsed.message || !productIds.length) return fallbackMessage(candidates);
  return { message: parsed.message, product_ids: productIds };
}
```

---

## Step 7 — Expose it — computed live, no cache table

`backend/src/routes/recommendations.js`:

```js
import { Router } from "express";
import { getUserProfileVector, retrieveForUser, trendingProducts, generateRecommendationMessage } from "../recommend.js";

const router = Router();

router.get("/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  const profile = await getUserProfileVector(userId);
  const candidates = profile ? await retrieveForUser(userId, profile, 20) : await trendingProducts(20);

  if (!candidates.length) return res.json({ message: null });

  const result = await generateRecommendationMessage(candidates);
  res.json(result);
});

export default router;
```

Mount in `server.js`:

```js
import recommendationsRouter from "./routes/recommendations.js";
app.use("/api/recommendations", recommendationsRouter);
```

Every call re-embeds nothing (products are pre-embedded) but does run one local LLM generation — expect a couple of seconds per request with `llama3.2`, since there's no cache layer.

---

## Step 8 — UI banner

Add to `frontend/src/api.js`:

```js
getRecommendation: (userId) => request(`/recommendations/${userId}`),
```

Fetch it in `App.jsx` whenever `currentUserId` changes, and render a banner above `<Routes>` if `message` is non-null.

---

## Run order, end to end

```bash
# one-time / whenever the catalog changes
node backend/src/embedProducts.js

# on-demand — no separate batch step
curl localhost:8001/api/recommendations/1
```
