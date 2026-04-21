import { Router } from "express";
import { chat, resetSession } from "../controllers/chatController.js";

const router = Router();
router.post("/", chat);
router.delete("/session/:sessionId", resetSession);
router.post("/session/reset", resetSession);

export default router;
