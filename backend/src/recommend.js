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