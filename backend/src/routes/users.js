import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const { rows } = await pool.query("SELECT id, name, email FROM users ORDER BY id");
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const { rows } = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [
    req.params.id,
  ]);
  if (!rows.length) return res.status(404).json({ error: "not found" });
  res.json(rows[0]);
});

export default router;
