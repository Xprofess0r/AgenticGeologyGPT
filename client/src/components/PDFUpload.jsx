import React, { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, X, Loader } from "lucide-react";
import { uploadPDF } from "../services/api";

export default function PDFUpload({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus]         = useState("idle"); // idle|uploading|success|error
  const [progress, setProgress]     = useState(0);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      setStatus("error");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File too large. Maximum 20 MB.");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setError(null);
    setProgress(0);

    try {
      const data = await uploadPDF(file, setProgress);
      setResult(data);
      setStatus("success");
      onUploadSuccess?.(data);
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const reset = () => {
    setStatus("idle"); setResult(null);
    setError(null); setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div style={s.wrapper}>
      {/* Header row */}
      <div style={s.headerRow}>
        <span style={s.sectionLabel}><FileText size={11} /> Upload Geology PDF</span>
        {status !== "idle" && (
          <button onClick={reset} style={s.resetBtn} title="Reset">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Drop zone */}
      {status === "idle" && (
        <div
          style={{ ...s.dropZone, ...(isDragging ? s.dragging : {}) }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div style={s.uploadIcon}>
            <Upload size={20} color={isDragging ? "var(--accent)" : "var(--text-muted)"} strokeWidth={1.5} />
          </div>
          <p style={s.dropMain}>
            Drop PDF or <span style={s.browseLink}>browse</span>
          </p>
          <p style={s.dropSub}>Max 20 MB · Notes, textbooks, papers</p>
          <input
            ref={inputRef} type="file" accept=".pdf,application/pdf"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* Uploading */}
      {status === "uploading" && (
        <div style={s.statusCard}>
          <Loader size={16} color="var(--accent)"
            style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={s.statusTitle}>Indexing PDF…</p>
            <div style={s.track}>
              <div style={{ ...s.fill, width: `${progress}%` }} />
            </div>
            <p style={s.progressNum}>{progress}% uploaded</p>
          </div>
        </div>
      )}

      {/* Success */}
      {status === "success" && (
        <div style={{ ...s.statusCard, ...s.successCard }}>
          <CheckCircle size={16} color="var(--success)" style={{ flexShrink: 0 }} />
          <div>
            <p style={s.statusTitle}>Indexed successfully!</p>
            <p style={s.statusSub}>
              {result?.chunksIndexed} chunks stored · Chat now uses your notes
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div style={{ ...s.statusCard, ...s.errorCard }}>
          <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0 }} />
          <div>
            <p style={s.statusTitle}>Upload failed</p>
            <p style={s.statusSub}>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrapper: { display: "flex", flexDirection: "column", gap: "8px" },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  sectionLabel: {
    display: "flex", alignItems: "center", gap: "5px",
    fontSize: "9.5px", fontFamily: "var(--font-mono)",
    color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em",
  },
  resetBtn: {
    background: "none", border: "none", cursor: "pointer",
    color: "var(--text-muted)", padding: "2px", display: "flex",
  },
  dropZone: {
    border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-md)",
    padding: "16px 12px", textAlign: "center", cursor: "pointer",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "5px",
    transition: "all 0.15s",
  },
  dragging: { borderColor: "var(--accent)", background: "var(--bg-active)" },
  uploadIcon: {
    width: "36px", height: "36px", borderRadius: "var(--radius-sm)",
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: "4px",
  },
  dropMain: { fontSize: "12px", color: "var(--text-secondary)" },
  browseLink: { color: "var(--accent)", textDecoration: "underline", cursor: "pointer" },
  dropSub: { fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" },
  statusCard: {
    display: "flex", alignItems: "flex-start", gap: "10px",
    padding: "10px 12px", borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)", background: "var(--bg-elevated)",
  },
  successCard: { borderColor: "rgba(74,140,90,0.35)", background: "rgba(74,140,90,0.05)" },
  errorCard:   { borderColor: "rgba(192,90,74,0.35)", background: "rgba(192,90,74,0.05)" },
  statusTitle: { fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "2px" },
  statusSub:   { fontSize: "10.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", lineHeight: "1.5" },
  track: {
    height: "3px", background: "var(--border)", borderRadius: "3px",
    overflow: "hidden", marginTop: "6px",
  },
  fill: {
    height: "100%", background: "var(--accent)", borderRadius: "3px",
    transition: "width 0.3s ease",
  },
  progressNum: { fontSize: "9.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "3px" },
};
