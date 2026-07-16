import { pool } from "./db.js";
import { embedTexts } from "./embedding.js";

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