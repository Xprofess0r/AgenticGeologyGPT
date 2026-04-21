/**
 * AgentSteps.jsx
 * Shows the agent's reasoning steps in a collapsible trace panel.
 * Renders below the AI bubble when steps are available.
 */

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Activity } from "lucide-react";

const NODE_COLORS = {
  queryAnalyzer: "#c8a84b",
  retriever:     "#4a8c5a",
  webSearch:     "#2d6b9c",
  reasoning:     "#7a5c9c",
  selfCorrector: "#9c5c5c",
  graph:         "var(--text-muted)",
};

export default function AgentSteps({ steps, route, runId }) {
  const [open, setOpen] = useState(false);

  if (!steps || steps.length === 0) return null;

  // Filter out graph-level noise, keep node steps
  const meaningful = steps.filter((s) => s.node !== "graph" || steps.length <= 3);

  return (
    <div style={s.wrapper}>
      <button style={s.toggle} onClick={() => setOpen((o) => !o)}>
        <Activity size={11} color="var(--text-muted)" />
        <span style={s.toggleLabel}>Agent trace</span>
        {route && <span style={s.routeBadge}>{route}</span>}
        {runId && <span style={s.runId}>#{runId}</span>}
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>

      {open && (
        <div style={s.trace}>
          {meaningful.map((step, i) => (
            <div key={i} style={s.step}>
              <div style={{ ...s.dot, background: NODE_COLORS[step.node] || "var(--border-strong)" }} />
              <div>
                <span style={{ ...s.nodeName, color: NODE_COLORS[step.node] || "var(--text-muted)" }}>
                  {step.node}
                </span>
                <span style={s.detail}>{step.detail}</span>
              </div>
              <span style={s.ts}>{step.ts}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  wrapper: { marginTop: "10px" },
  toggle: {
    display: "flex", alignItems: "center", gap: "5px",
    background: "none", border: "none", cursor: "pointer",
    padding: "3px 0", color: "var(--text-muted)",
  },
  toggleLabel: { fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" },
  routeBadge: {
    fontSize: "9px", fontFamily: "var(--font-mono)",
    background: "var(--bg-active)", border: "1px solid var(--border)",
    color: "var(--accent-dim)", padding: "1px 5px", borderRadius: "10px",
  },
  runId: { fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" },
  trace: {
    marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px",
    padding: "8px 10px", background: "var(--bg-base)",
    border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
  },
  step: {
    display: "flex", alignItems: "flex-start", gap: "8px",
    fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4",
  },
  dot: { width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0, marginTop: "4px" },
  nodeName: { fontFamily: "var(--font-mono)", fontSize: "10px", marginRight: "6px", fontWeight: 600 },
  detail: { fontSize: "10.5px", color: "var(--text-muted)" },
  ts: { marginLeft: "auto", fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", flexShrink: 0 },
};
