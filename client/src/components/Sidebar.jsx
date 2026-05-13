import React from "react";
import { MessageSquare, FileText, Mountain, Upload, Activity, X, ChevronRight } from "lucide-react";

const NAV_ITEMS = [
  { id: "chat",    label: "Agentic Chat",    icon: MessageSquare, badge: null   },
  { id: "explain", label: "Notes Explainer", icon: FileText,      badge: null   },
  { id: "upload",  label: "Upload Notes",    icon: Upload,        badge: null   },
  { id: "logs",    label: "Agent Logs",      icon: Activity,      badge: null   },
];

const QUICK_TOPICS = [
  "What is plate tectonics?",
  "Types of igneous rocks",
  "How are fossils formed?",
  "Explain fault lines",
  "Mineral identification",
  "Latest earthquake research",
];

export default function Sidebar({ activeView, onViewChange, onQuickTopic, isOpen, onClose }) {
  return (
    <aside className={`sidebar ${isOpen ? "sidebar--open" : ""}`}>
      <div className="sidebar-inner">
        {/* Logo + close button */}
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Mountain size={20} color="#c8a84b" strokeWidth={1.5} />
          </div>
          <div className="logo-text">
            <div className="logo-title">GeologyGPT</div>
            <div className="logo-sub">Agentic RAG · v3</div>
          </div>
          <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="nav-label">Navigation</div>
          {NAV_ITEMS.map((item) => {
            const Icon     = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`nav-btn ${isActive ? "nav-btn--active" : ""}`}
              >
                <Icon size={16} strokeWidth={1.8} className="nav-icon" />
                <span className="nav-label-text">{item.label}</span>
                {isActive && <ChevronRight size={14} color="#c8a84b" />}
              </button>
            );
          })}
        </nav>

        {/* Quick Topics */}
        <div className="sidebar-topics">
          <div className="nav-label">Quick Topics</div>
          {QUICK_TOPICS.map((topic) => (
            <button key={topic} className="topic-btn" onClick={() => onQuickTopic(topic)}>
              <span className="topic-dot" />
              {topic}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="footer-tag">Gemini · Pinecone · Tavily</div>
          <div className="footer-sub">v3.0 · Agentic RAG</div>
        </div>
      </div>
    </aside>
  );
}
