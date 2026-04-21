import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Sparkles, Copy, Check, RotateCcw } from "lucide-react";
import { explainNotes } from "../services/api";

const CHAR_LIMIT = 8000;

const SAMPLE_TEXT = `Bowen's Reaction Series describes the sequence in which silicate minerals crystallize from a cooling magma. The series is divided into two branches: the discontinuous branch (olivine → pyroxene → amphibole → biotite) and the continuous branch (Ca-rich plagioclase → Na-rich plagioclase). Both branches converge at potassium feldspar, muscovite, and quartz at lower temperatures. Early-crystallizing minerals are typically denser and Mg/Fe-rich (mafic), while late-crystallizing minerals are Si-rich (felsic). This sequence explains the compositional variation observed in igneous rock suites and the concept of fractional crystallization.`;

export default function ExplainPage() {
  const [input, setInput]         = useState("");
  const [output, setOutput]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [copied, setCopied]       = useState(false);

  const charCount   = input.length;
  const isOverLimit = charCount > CHAR_LIMIT;
  const canSubmit   = input.trim().length > 0 && !isLoading && !isOverLimit;

  const handleExplain = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);
    setOutput("");
    try {
      const result = await explainNotes(input);
      setOutput(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleReset = () => {
    setInput("");
    setOutput("");
    setError(null);
  };

  const loadSample = () => setInput(SAMPLE_TEXT);

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Notes Explainer</h1>
          <p style={styles.subtitle}>
            Paste complex geology text — get a clear, structured breakdown
          </p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={loadSample} style={styles.ghostBtn}>
            Load Sample
          </button>
          {(input || output) && (
            <button onClick={handleReset} style={styles.ghostBtn}>
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Split pane body ── */}
      <div style={styles.body}>
        {/* Left — Input */}
        <div style={styles.pane}>
          <div style={styles.paneHeader}>
            <span style={styles.paneLabel}>
              <FileText size={12} /> Input Notes
            </span>
            <span
              style={{
                ...styles.charCounter,
                color: isOverLimit ? "var(--danger)" : "var(--text-muted)",
              }}
            >
              {charCount.toLocaleString()} / {CHAR_LIMIT.toLocaleString()}
            </span>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              "Paste your geology notes, textbook excerpt, or research paper section here…\n\nExamples:\n• Bowen's reaction series\n• Plate tectonic theory\n• Sedimentary facies analysis\n• Any complex geology concept"
            }
            style={styles.textarea}
          />

          {isOverLimit && (
            <div style={styles.limitWarning}>
              ⚠ Text exceeds {CHAR_LIMIT.toLocaleString()} character limit.
              Please shorten your input.
            </div>
          )}

          <div style={styles.paneFooter}>
            <button
              onClick={handleExplain}
              disabled={!canSubmit}
              style={{
                ...styles.explainBtn,
                opacity: canSubmit ? 1 : 0.45,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              {isLoading ? (
                <>
                  <span style={styles.btnSpinner} />
                  Explaining…
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Explain with AI
                </>
              )}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={styles.divider} />

        {/* Right — Output */}
        <div style={styles.pane}>
          <div style={styles.paneHeader}>
            <span style={styles.paneLabel}>
              <Sparkles size={12} /> Simplified Explanation
            </span>
            {output && (
              <button onClick={handleCopy} style={styles.copyBtn}>
                {copied ? (
                  <><Check size={11} /> Copied!</>
                ) : (
                  <><Copy size={11} /> Copy</>
                )}
              </button>
            )}
          </div>

          <div style={styles.outputScroll}>
            {/* Loading state */}
            {isLoading && (
              <div style={styles.loadingCenter}>
                <div style={styles.dotsRow}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        ...styles.dot,
                        animationDelay: `${i * 0.18}s`,
                      }}
                    />
                  ))}
                </div>
                <p style={styles.loadingLabel}>
                  Dr. Terra is analysing your notes…
                </p>
              </div>
            )}

            {/* Error */}
            {error && !isLoading && (
              <div style={styles.errorBox}>
                <strong style={{ color: "var(--danger)" }}>⚠ Error:</strong>{" "}
                {error}
              </div>
            )}

            {/* Output markdown */}
            {output && !isLoading && (
              <div
                className="markdown-body"
                style={{ animation: "fadeUp 0.4s var(--ease) both" }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {output}
                </ReactMarkdown>
              </div>
            )}

            {/* Placeholder */}
            {!output && !isLoading && !error && (
              <div style={styles.outputPlaceholder}>
                <FileText
                  size={34}
                  color="var(--border-strong)"
                  strokeWidth={1}
                />
                <p>Your simplified explanation will appear here</p>
                <p style={{ fontSize: "11px", marginTop: "6px" }}>
                  Dr. Terra will summarise key concepts, define terms, and
                  highlight what matters most.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--bg-base)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 28px 16px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
    background: "var(--bg-surface)",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: "11.5px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    marginTop: "2px",
  },
  headerActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  ghostBtn: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "6px 13px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-muted)",
    fontSize: "12px",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  pane: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minWidth: 0,
  },
  divider: {
    width: "1px",
    background: "var(--border)",
    flexShrink: 0,
  },
  paneHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 20px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)",
    flexShrink: 0,
  },
  paneLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "10.5px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  charCounter: {
    fontSize: "10.5px",
    fontFamily: "var(--font-mono)",
    transition: "color 0.2s",
  },
  textarea: {
    flex: 1,
    background: "var(--bg-base)",
    border: "none",
    color: "var(--text-primary)",
    fontSize: "13.5px",
    fontFamily: "var(--font-body)",
    padding: "20px",
    resize: "none",
    outline: "none",
    lineHeight: "1.75",
  },
  limitWarning: {
    padding: "8px 20px",
    background: "rgba(192,90,74,0.08)",
    borderTop: "1px solid rgba(192,90,74,0.3)",
    color: "var(--danger)",
    fontSize: "12px",
    fontFamily: "var(--font-mono)",
  },
  paneFooter: {
    padding: "12px 16px",
    borderTop: "1px solid var(--border)",
    background: "var(--bg-surface)",
    flexShrink: 0,
  },
  explainBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    padding: "11px",
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-md)",
    color: "#0c0f0a",
    fontSize: "13.5px",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    letterSpacing: "0.01em",
    transition: "opacity 0.15s",
  },
  btnSpinner: {
    display: "inline-block",
    width: "13px",
    height: "13px",
    border: "2px solid rgba(0,0,0,0.15)",
    borderTopColor: "#0c0f0a",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
  copyBtn: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 10px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-muted)",
    fontSize: "11px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    transition: "all 0.15s",
  },
  outputScroll: {
    flex: 1,
    overflowY: "auto",
    padding: "22px",
  },
  outputPlaceholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "12px",
    color: "var(--text-muted)",
    fontSize: "13px",
    textAlign: "center",
    fontFamily: "var(--font-mono)",
    opacity: 0.45,
    lineHeight: "1.6",
  },
  loadingCenter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "18px",
  },
  dotsRow: {
    display: "flex",
    gap: "7px",
    alignItems: "center",
  },
  dot: {
    display: "inline-block",
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    background: "var(--accent)",
    animation: "pulse 1.3s infinite ease-in-out",
  },
  loadingLabel: {
    fontSize: "12px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    fontStyle: "italic",
  },
  errorBox: {
    padding: "14px 18px",
    background: "rgba(192,90,74,0.08)",
    border: "1px solid rgba(192,90,74,0.3)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-secondary)",
    fontSize: "13.5px",
    lineHeight: "1.6",
  },
};
