import React, { useState } from "react";
import { Upload, BookOpen, Database, Info } from "lucide-react";
import PDFUpload from "../components/PDFUpload";

export default function UploadPage() {
  const [uploads, setUploads] = useState([]);

  const handleSuccess = (data) => {
    setUploads((prev) => [
      { ...data, timestamp: new Date().toLocaleTimeString() },
      ...prev,
    ]);
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Upload Notes</h1>
          <p style={s.subtitle}>Index your geology PDFs for RAG-powered answers</p>
        </div>
      </div>

      <div style={s.body}>
        {/* Info banner */}
        <div style={s.infoBanner}>
          <Info size={13} color="var(--accent-dim)" style={{ flexShrink: 0, marginTop: "1px" }} />
          <p style={s.infoText}>
            Uploaded PDFs are chunked, embedded, and stored in Pinecone.
            Dr. Terra will automatically reference them when answering your questions in chat.
          </p>
        </div>

        {/* Upload card */}
        <div style={s.card}>
          <h2 style={s.cardTitle}><Upload size={14} /> Add Document</h2>
          <p style={s.cardDesc}>
            Upload geology notes, textbook chapters, or research papers.
            Supported: PDF up to 20 MB.
          </p>
          <PDFUpload onUploadSuccess={handleSuccess} />
        </div>

        {/* Indexed documents */}
        {uploads.length > 0 && (
          <div style={s.card}>
            <h2 style={s.cardTitle}><Database size={14} /> Indexed This Session</h2>
            <div style={s.uploadList}>
              {uploads.map((u, i) => (
                <div key={i} style={s.uploadRow}>
                  <div style={s.uploadLeft}>
                    <BookOpen size={13} color="var(--accent-dim)" />
                    <span style={s.uploadName}>
                      {u.source?.replace(/_/g, " ").replace(/\.pdf$/i, "")}
                    </span>
                  </div>
                  <div style={s.uploadRight}>
                    <span style={s.uploadChunks}>{u.chunksIndexed} chunks</span>
                    <span style={s.uploadTime}>{u.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        <div style={s.card}>
          <h2 style={s.cardTitle}><Info size={14} /> Tips for Best Results</h2>
          <ul style={s.tipList}>
            {[
              "Use text-based PDFs (not scanned images) for accurate extraction.",
              "Upload topic-specific notes for precise retrieval — e.g., one file for stratigraphy.",
              "Larger PDFs are split into overlapping chunks automatically.",
              "Re-upload a file to refresh its index (old vectors will be overwritten).",
              "Ask specific questions in chat to get the most relevant chunks retrieved.",
            ].map((tip, i) => (
              <li key={i} style={s.tip}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-base)", overflow: "hidden" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 28px 16px", borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)", flexShrink: 0,
  },
  title: {
    fontFamily: "var(--font-display)", fontSize: "17px",
    fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)",
  },
  subtitle: { fontSize: "11.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "2px" },
  body: { flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: "14px" },

  infoBanner: {
    display: "flex", gap: "10px", alignItems: "flex-start",
    padding: "12px 14px", borderRadius: "var(--radius-md)",
    background: "rgba(200,168,75,0.05)", border: "1px solid rgba(200,168,75,0.15)",
  },
  infoText: { fontSize: "12.5px", color: "var(--text-muted)", lineHeight: "1.6" },

  card: {
    background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", padding: "18px 20px",
  },
  cardTitle: {
    display: "flex", alignItems: "center", gap: "8px",
    fontFamily: "var(--font-display)", fontSize: "13.5px", fontWeight: 700,
    color: "var(--text-primary)", marginBottom: "6px",
  },
  cardDesc: { fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6", marginBottom: "14px" },

  uploadList: { display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" },
  uploadRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "9px 12px", borderRadius: "var(--radius-sm)",
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
  },
  uploadLeft: { display: "flex", alignItems: "center", gap: "8px" },
  uploadName: { fontSize: "12.5px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" },
  uploadRight: { display: "flex", alignItems: "center", gap: "10px" },
  uploadChunks: {
    fontSize: "10.5px", color: "var(--accent-dim)", fontFamily: "var(--font-mono)",
    background: "var(--bg-active)", padding: "2px 7px", borderRadius: "10px",
  },
  uploadTime: { fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" },

  tipList: { paddingLeft: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "7px", marginTop: "8px" },
  tip: {
    fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.55",
    paddingLeft: "14px", position: "relative",
    "::before": { content: '"›"', position: "absolute", left: 0 },
  },
};
