import React from "react";
import {
  MessageSquare, FileText, Map, LayoutDashboard,
  Mountain, ChevronRight, Upload, Activity,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "chat",      label: "Agentic Chat",    icon: MessageSquare,   badge: null   },
  { id: "explain",   label: "Notes Explainer", icon: FileText,        badge: null   },
  { id: "upload",    label: "Upload Notes",    icon: Upload,          badge: null   },
  { id: "logs",      label: "Agent Logs",      icon: Activity,        badge: null   },
  { id: "gis",       label: "GIS Tools",       icon: Map,             badge: "Soon" },
  { id: "dashboard", label: "Dashboard",       icon: LayoutDashboard, badge: "Soon" },
];

const QUICK_TOPICS = [
  "What is plate tectonics?",
  "Types of igneous rocks",
  "How are fossils formed?",
  "Explain fault lines",
  "Mineral identification",
  "Latest earthquake research",
];

export default function Sidebar({ activeView, onViewChange, onQuickTopic }) {
  return (
    <aside style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logo}>
        <div style={styles.logoIcon}>
          <Mountain size={20} color="#c8a84b" strokeWidth={1.5} />
        </div>
        <div>
          <div style={styles.logoTitle}>GeologyGPT</div>
          <div style={styles.logoSub}>Agentic RAG · v3</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        <div style={styles.navLabel}>Navigation</div>
        {NAV_ITEMS.map((item) => {
          const Icon       = item.icon;
          const isActive   = activeView === item.id;
          const isDisabled = item.badge === "Soon";
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onViewChange(item.id)}
              style={{
                ...styles.navBtn,
                ...(isActive   ? styles.navBtnActive   : {}),
                ...(isDisabled ? styles.navBtnDisabled : {}),
              }}
              disabled={isDisabled}
            >
              <Icon size={16} strokeWidth={1.8}
                style={{ color: isActive ? "#c8a84b" : "var(--text-muted)" }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && <span style={styles.badge}>{item.badge}</span>}
              {isActive && <ChevronRight size={14} color="#c8a84b" />}
            </button>
          );
        })}
      </nav>

      {/* Quick Topics */}
      <div style={styles.quickSection}>
        <div style={styles.navLabel}>Quick Topics</div>
        {QUICK_TOPICS.map((topic) => (
          <button key={topic} style={styles.topicBtn} onClick={() => onQuickTopic(topic)}>
            <span style={styles.topicDot} />
            {topic}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={styles.sidebarFooter}>
        <div style={styles.footerTag}>Gemini · Pinecone · Tavily</div>
        <div style={styles.footerSub}>v3.0 · Agentic RAG</div>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "260px", minWidth: "260px", height: "100vh",
    background: "var(--bg-surface)", borderRight: "1px solid var(--border)",
    display: "flex", flexDirection: "column", overflow: "hidden",
  },
  logo: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "20px 18px", borderBottom: "1px solid var(--border)",
  },
  logoIcon: {
    width: "38px", height: "38px",
    background: "linear-gradient(135deg, #1a2a18 0%, #223320 100%)",
    border: "1px solid var(--border-strong)", borderRadius: "10px",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  logoTitle: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "15px", color: "var(--text-primary)", letterSpacing: "-0.02em" },
  logoSub: { fontSize: "10px", color: "var(--accent-dim)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", marginTop: "1px" },
  nav: { padding: "16px 10px 8px", display: "flex", flexDirection: "column", gap: "2px" },
  navLabel: { fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 8px 8px" },
  navBtn: {
    display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px",
    borderRadius: "var(--radius-md)", border: "1px solid transparent", background: "transparent",
    color: "var(--text-secondary)", fontSize: "13.5px", fontFamily: "var(--font-body)",
    cursor: "pointer", width: "100%", textAlign: "left", transition: "all 0.15s var(--ease)", fontWeight: 500,
  },
  navBtnActive: { background: "var(--bg-active)", color: "var(--text-primary)", border: "1px solid var(--border-strong)" },
  navBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },
  badge: { fontSize: "9px", fontFamily: "var(--font-mono)", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)", padding: "1px 6px", borderRadius: "20px" },
  quickSection: { padding: "16px 10px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "2px", flex: 1, overflowY: "auto" },
  topicBtn: {
    display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px",
    borderRadius: "var(--radius-sm)", border: "none", background: "transparent",
    color: "var(--text-muted)", fontSize: "12.5px", fontFamily: "var(--font-body)",
    cursor: "pointer", width: "100%", textAlign: "left", lineHeight: "1.3",
  },
  topicDot: { width: "4px", height: "4px", borderRadius: "50%", background: "var(--border-strong)", flexShrink: 0 },
  sidebarFooter: { padding: "14px 18px", borderTop: "1px solid var(--border)" },
  footerTag: { fontSize: "11px", color: "var(--accent-dim)", fontFamily: "var(--font-mono)" },
  footerSub: { fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", fontFamily: "var(--font-mono)" },
};
