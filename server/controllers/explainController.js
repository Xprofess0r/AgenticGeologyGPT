/**
 * explainController.js  (v4.0)
 * CHANGE: Removed isGeologyQuery guard — was blocking valid notes submissions
 */

import { getNotesExplanation } from "../services/geminiService.js";

export async function explain(req, res) {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "text field is required" });
    }
    if (text.length > 8000) {
      return res.status(400).json({ error: "Text too long. Maximum 8000 characters." });
    };

    const explanation = await getNotesExplanation(text);
    res.json({ explanation });
  } catch (err) {
    console.error("[ExplainController]", err.message);
    res.status(500).json({ error: "Failed to explain notes" });
  }
};