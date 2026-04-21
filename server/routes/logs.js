import { Router } from "express";
import { readRecentLogs } from "../utils/logger.js";

const router = Router();

router.get("/", (req, res) => {
  const n = parseInt(req.query.n) || 20;
  const logs = readRecentLogs(Math.min(n, 100));
  res.json({ count: logs.length, runs: logs });
});

export default router;
