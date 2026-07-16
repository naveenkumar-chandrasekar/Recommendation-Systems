import { Router } from "express";
import { getUserProfileVector, retrieveForUser, trendingProducts, generateRecommendationMessage } from "../recommend.js";

const router = Router();

router.get("/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  const profile = await getUserProfileVector(userId);
  const candidates = profile ? await retrieveForUser(userId, profile, 20) : await trendingProducts(20);

  if (!candidates.length) return res.json({ message: null, products: [] });

  const result = await generateRecommendationMessage(candidates);
  // Display is the full, already-vetted candidate list -- not gated on however many
  // ids the model chose to cite in its message (that count is inconsistent: sometimes
  // 1, sometimes nearly all of them). The message stays as narrative flavor text.
  res.json({ message: result.message, products: candidates });
});

export default router;