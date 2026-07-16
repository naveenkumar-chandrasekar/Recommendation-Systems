import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const { category } = req.query;
  const limit = Math.min(Number(req.query.limit) || 60, 200);
  const offset = Number(req.query.offset) || 0;

  const params = [];
  let sql = "SELECT id, title, description, category, price, image_url FROM products";
  if (category) {
    params.push(category);
    sql += " WHERE category = $1";
  }
  sql += ` ORDER BY id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

// must be registered before "/:id" or it'll be matched as an id param
router.get("/categories", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT DISTINCT category FROM products ORDER BY category"
  );
  res.json(rows.map((r) => r.category));
});

router.get("/:id", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, title, description, category, price, image_url FROM products WHERE id = $1",
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });
  res.json(rows[0]);
});

export default router;
