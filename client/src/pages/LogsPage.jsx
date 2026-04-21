import React, { useState, useEffect } from "react";
import { Activity, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { fetchLogs } from "../services/api";

export default function LogsPage() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchLogs(30);
      setLogs(data.runs || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const routeColor = { rag: "#4a8c5a", web: "#2d6b9c", parallel: "#7a5c9c", direct: "#c8a84b" };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}><Activity size={15} style={{ marginRight: 8 }} />Agent Logs</h1>
          <p style={s.subtitle}>LangSmith-style observability · Last 30 runs</p>
        </div>
        <button onClick={load} style={s.refreshBtn} disabled={loading}>
          <RefreshCw size={13} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          Refresh
        </button>
      </div>

      <div style={s.body}>
        {error && <div style={s.errorBox}>⚠ {error}</div>}

        {loading && (
          <div style={s.center}><span style={s.loadingDot} /> Loading runs…</div>
        )}

        {!loading && logs.length === 0 && (
          <div style={s.center}>No agent runs logged yet. Start a chat!</div>
        )}

        {!loading && logs.map((run) => (
          <div key={run.runId} style={s.runCard}>
            {/* Run header */}
            <button style={s.runHeader} onClick={() => toggle(run.runId)}>
              <div style={s.runLeft}>
                {expanded[run.runId]
                  ? <ChevronDown size={12} color="var(--text-muted)" />
                  : <ChevronRight size={12} color="var(--text-muted)" />
                }
                <span style={s.runId}>#{run.runId}</span>
                <span
                  style={{ ...s.routeBadge, color: routeColor[run.route] || "var(--text-muted)",
                    borderColor: (routeColor[run.route] || "#555") + "50" }}
                >
                  {run.route || "unknown"}
                </span>
                <span style={s.query}>{run.query?.slice(0, 70)}…</span>
              </div>
              <div style={s.runRight}>
                {run.confidence != null && (
                  <span style={s.conf}>{Math.round(run.confidence * 100)}%</span>
                )}
                <span style={s.duration}>{run.durationMs}ms</span>
                <span style={s.ts}>{new Date(run.timestamp).toLocaleTimeString()}</span>
              </div>
            </button>

            {/* Expanded detail */}
            {expanded[run.runId] && (
              <div style={s.detail}>
                {/* Steps */}
                <div style={s.section}>
                  <p style={s.sectionLabel}>Steps</p>
                  {run.steps?.map((step, i) => (
                    <div key={i} style={s.stepRow}>
                      <span style={s.stepNode}>{step.node}</span>
                      <span style={s.stepDetail}>{step.detail}</span>
                      <span style={s.stepTs}>{step.ts}ms</span>
                    </div>
                  ))}
                </div>

                {/* Tool calls */}
                {run.toolCalls?.length > 0 && (
                  <div style={s.section}>
                    <p style={s.sectionLabel}>Tool Calls</p>
                    {run.toolCalls.map((tc, i) => (
                      <div key={i} style={s.toolRow}>
                        <span style={s.toolName}>{tc.tool}</span>
                        <span style={s.toolDetail}>{tc.output?.slice(0, 80)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Retrieved chunks */}
                {run.retrievedChunks?.length > 0 && (
                  <div style={s.section}>
                    <p style={s.sectionLabel}>Retrieved Chunks ({run.retrievedChunks.length})</p>
                    {run.retrievedChunks.map((c, i) => (
                      <div key={i} style={s.chunkRow}>
                        <span style={s.chunkSrc}>{c.source}</span>
                        <span style={s.chunkScore}>{Math.round((c.score || 0) * 100)}%</span>
                        <span style={s.chunkPrev}>{c.preview?.slice(0, 100)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Evaluation */}
                {run.evaluation && (
                  <div style={s.section}>
                    <p style={s.sectionLabel}>RAGAS-style Evaluation</p>
                    <div style={s.evalRow}>
                      <span style={s.evalKey}>Answer Relevancy</span>
                      <span style={s.evalVal}>{Math.round((run.evaluation.answerRelevancy || 0) * 100)}%</span>
                    </div>
                    <div style={s.evalRow}>
                      <span style={s.evalKey}>Context Precision</span>
                      <span style={s.evalVal}>{Math.round((run.evaluation.contextPrecision || 0) * 100)}%</span>
                    </div>
                    {run.evaluation.weakReason && (
                      <div style={s.evalRow}>
                        <span style={s.evalKey}>Weak Reason</span>
                        <span style={{ ...s.evalVal, color: "var(--danger)" }}>{run.evaluation.weakReason}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
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
    display: "flex", alignItems: "center",
    fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 700,
    letterSpacing: "-0.02em", color: "var(--text-primary)",
  },
  subtitle: { fontSize: "11.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "2px" },
  refreshBtn: {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "6px 13px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", color: "var(--text-muted)", fontSize: "12px",
    cursor: "pointer", fontFamily: "var(--font-body)",
  },
  body: { flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: "8px" },
  errorBox: {
    padding: "10px 14px", background: "rgba(192,90,74,0.08)", border: "1px solid rgba(192,90,74,0.3)",
    borderRadius: "var(--radius-md)", color: "var(--danger)", fontSize: "12px",
  },
  center: { textAlign: "center", color: "var(--text-muted)", fontSize: "13px", padding: "40px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" },
  loadingDot: { display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent)", animation: "pulse 1.2s infinite" },
  runCard: {
    background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)", overflow: "hidden",
  },
  runHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
    width: "100%", textAlign: "left",
  },
  runLeft: { display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 },
  runRight: { display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 },
  runId: { fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" },
  routeBadge: { fontSize: "9px", fontFamily: "var(--font-mono)", padding: "1px 6px", borderRadius: "10px", border: "1px solid" },
  query: { fontSize: "12px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 },
  conf: { fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent)" },
  duration: { fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" },
  ts: { fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" },
  detail: { padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-base)", display: "flex", flexDirection: "column", gap: "12px" },
  section: {},
  sectionLabel: { fontSize: "9.5px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" },
  stepRow: { display: "flex", gap: "8px", alignItems: "flex-start", padding: "3px 0", borderBottom: "1px solid var(--border)" },
  stepNode: { fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--accent)", width: "110px", flexShrink: 0 },
  stepDetail: { fontSize: "11px", color: "var(--text-muted)", flex: 1 },
  stepTs: { fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", flexShrink: 0 },
  toolRow: { display: "flex", gap: "8px", padding: "3px 0" },
  toolName: { fontSize: "10px", fontFamily: "var(--font-mono)", color: "#5a9fd4", width: "120px", flexShrink: 0 },
  toolDetail: { fontSize: "11px", color: "var(--text-muted)" },
  chunkRow: { display: "flex", gap: "8px", padding: "3px 0", flexWrap: "wrap" },
  chunkSrc: { fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--accent-dim)" },
  chunkScore: { fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: "8px", border: "1px solid var(--border)" },
  chunkPrev: { fontSize: "11px", color: "var(--text-muted)", width: "100%", fontStyle: "italic" },
  evalRow: { display: "flex", gap: "10px", padding: "3px 0" },
  evalKey: { fontSize: "11px", color: "var(--text-muted)", width: "150px", flexShrink: 0 },
  evalVal: { fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" },
};
