/**
 * uploadController.js
 * POST /api/upload
 * Accepts a PDF, runs full RAG ingestion pipeline.
 */

import { ingestPDF } from "../services/ragService.js";

export async function uploadPDF(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded. Use field name 'pdf'." });
    }

    const { originalname, buffer, mimetype } = req.file;

    if (mimetype !== "application/pdf" && !originalname.toLowerCase().endsWith(".pdf")) {
      return res.status(400).json({ error: "Only PDF files are supported." });
    }

    console.log(`[Upload] Processing: ${originalname} (${(buffer.length / 1024).toFixed(1)} KB)`);

    const result = await ingestPDF(buffer, originalname);

    res.json({
      success: true,
      message: `Successfully processed "${originalname}"`,
      chunksIndexed: result.chunksCount,
      source: result.source,
    });
  } catch (err) {
    console.error("[UploadController]", err.message);
    res.status(500).json({ error: err.message || "Failed to process PDF" });
  }
}
