import { Router } from "express";
import { explain } from "../controllers/explainController.js";

const router = Router();
router.post("/", explain);

export default router;
