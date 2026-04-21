/**
 * explainController.js  (v3.1)
 * Added geology guard — rejects non-geology text submissions.
 */

import { getNotesExplanation, isGeologyQuery, OFF_TOPIC_REPLY } from "../services/geminiService.js";

export async function explain(req, res) {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "text field is required" });
    }
    if (text.length > 8000) {
      return res.status(400).json({ error: "Text too long. Maximum 8000 characters." });
    }

    // Geology guard — check first 300 chars as a proxy
    if (!isGeologyQuery(text.slice(0, 300))) {
      return res.json({ explanation: OFF_TOPIC_REPLY });
    }

    const explanation = await getNotesExplanation(text);
    res.json({ explanation });
  } catch (err) {
    console.error("[ExplainController]", err.message);
    res.status(500).json({ error: "Failed to explain notes" });
  }
}
