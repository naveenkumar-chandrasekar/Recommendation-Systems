import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const { user_id } = req.query;
  const params = [];
  let sql = `
    SELECT o.id, o.user_id, o.total, o.created_at,
           json_agg(json_build_object(
             'product_id', oi.product_id,
             'title', p.title,
             'quantity', oi.quantity,
             'unit_price', oi.unit_price
           ) ORDER BY oi.id) AS items
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
  `;
  if (user_id) {
    params.push(user_id);
    sql += " WHERE o.user_id = $1";
  }
  sql += " GROUP BY o.id ORDER BY o.created_at DESC";
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { user_id, items } = req.body;
  if (!user_id || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "user_id and items are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const productIds = items.map((i) => i.product_id);
    const { rows: products } = await client.query(
      "SELECT id, price FROM products WHERE id = ANY($1)",
      [productIds]
    );
    if (products.length !== new Set(productIds).size) {
      throw Object.assign(new Error("one or more product_ids do not exist"), { status: 400 });
    }
    const priceById = Object.fromEntries(products.map((p) => [p.id, Number(p.price)]));

    const total = items.reduce((sum, i) => sum + priceById[i.product_id] * i.quantity, 0);

    const { rows: orderRows } = await client.query(
      "INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING id, created_at",
      [user_id, total]
    );
    const orderId = orderRows[0].id;

    for (const item of items) {
      await client.query(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)",
        [orderId, item.product_id, item.quantity, priceById[item.product_id]]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ id: orderId, total, created_at: orderRows[0].created_at });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(err.status || 500).json({ error: err.message || "failed to create order" });
  } finally {
    client.release();
  }
});

export default router;
