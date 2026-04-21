/**
 * ConfidenceBadge.jsx
 * Displays confidence score as a colored pill with a small bar.
 */

import React from "react";

export default function ConfidenceBadge({ score, evaluation }) {
  if (score === null || score === undefined) return null;

  const pct    = Math.round(score * 100);
  const color  = pct >= 70 ? "#4a8c5a" : pct >= 45 ? "#c8a84b" : "#c05a4a";
  const label  = pct >= 70 ? "High" : pct >= 45 ? "Medium" : "Low";

  return (
    <div style={{ ...s.wrapper, borderColor: color + "40" }}>
      <div style={{ ...s.bar, width: `${pct}%`, background: color }} />
      <span style={{ ...s.label, color }}>
        {label} confidence · {pct}%
      </span>
      {evaluation && (
        <span style={s.eval}>
          Relevancy {Math.round((evaluation.answerRelevancy || 0) * 100)}%
          {evaluation.contextPrecision > 0 && ` · Precision ${Math.round(evaluation.contextPrecision * 100)}%`}
        </span>
      )}
    </div>
  );
}

const s = {
  wrapper: {
    position: "relative", overflow: "hidden",
    display: "flex", alignItems: "center", gap: "10px",
    padding: "5px 10px", borderRadius: "var(--radius-sm)",
    border: "1px solid", background: "var(--bg-base)",
    marginTop: "10px",
  },
  bar: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    opacity: 0.08, transition: "width 0.4s ease",
  },
  label: { fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: 600, position: "relative" },
  eval:  { fontSize: "9.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", position: "relative" },
};
