import { Router } from "express";
import {
  getVisitorStats,
  getVisitorTotal,
  incrementVisitorCounter,
} from "../lib/visitorService";

const router = Router();

router.post("/increment", async (_req, res) => {
  try {
    const total = await incrementVisitorCounter();
    res.json({ total });
  } catch (err) {
    console.error("Error incrementing visitors:", err);
    res.status(500).json({ error: "Failed to increment visitors" });
  }
});

router.get("/total", async (_req, res) => {
  try {
    const total = await getVisitorTotal();
    res.json({ total });
  } catch (err) {
    console.error("Error fetching visitor total:", err);
    res.status(500).json({ error: "Failed to load visitor total" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 30;
    const stats = await getVisitorStats(days);
    res.json(stats);
  } catch (err) {
    console.error("Error fetching visitor stats:", err);
    res.status(500).json({ error: "Failed to load visitor stats" });
  }
});

export default router;
