import React, { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import ChatPage from "./pages/ChatPage";
import ExplainPage from "./pages/ExplainPage";
import UploadPage from "./pages/UploadPage";
import LogsPage from "./pages/LogsPage";

export default function App() {
  const [activeView, setActiveView]   = useState("chat");
  const [quickTopic, setQuickTopic]   = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleQuickTopic = useCallback((topic) => {
    setActiveView("chat");
    setQuickTopic(topic);
    setSidebarOpen(false);
  }, []);

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
    setSidebarOpen(false);
  }, []);

  const renderPage = () => {
    switch (activeView) {
      case "chat":    return <ChatPage initialPrompt={quickTopic} onPromptConsumed={() => setQuickTopic(null)} />;
      case "explain": return <ExplainPage />;
      case "upload":  return <UploadPage />;
      case "logs":    return <LogsPage />;
      default:        return <ChatPage />;
    }
  };

  return (
    <div className="app-root">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        onQuickTopic={handleQuickTopic}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="app-main">
        {/* Mobile top bar */}
        <div className="mobile-topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <span /><span /><span />
          </button>
          <span className="mobile-title">GeologyGPT</span>
          <span className="mobile-badge">v3</span>
        </div>

        <main className="main-content">{renderPage()}</main>
      </div>
    </div>
  );
}
