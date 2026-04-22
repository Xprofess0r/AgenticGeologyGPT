import { Router } from "express";
import { chat, resetSession, agentStatus } from "../controllers/chatController.js";

const router = Router();

router.post("/",                    chat);
router.get("/agent-status",         agentStatus);
router.delete("/session/:sessionId", resetSession);
router.post("/session/reset",        resetSession);

export default router;
