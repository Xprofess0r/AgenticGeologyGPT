import React, { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import ChatPage from "./pages/ChatPage";
import ExplainPage from "./pages/ExplainPage";
import GISPage from "./pages/GISPage";
import DashboardPage from "./pages/DashboardPage";
import UploadPage from "./pages/UploadPage";
import LogsPage from "./pages/LogsPage";

export default function App() {
  const [activeView, setActiveView] = useState("chat");
  const [quickTopic, setQuickTopic] = useState(null);

  const handleQuickTopic = useCallback((topic) => {
    setActiveView("chat");
    setQuickTopic(topic);
  }, []);

  const renderPage = () => {
    switch (activeView) {
      case "chat":      return <ChatPage initialPrompt={quickTopic} onPromptConsumed={() => setQuickTopic(null)} />;
      case "explain":   return <ExplainPage />;
      case "upload":    return <UploadPage />;
      case "logs":      return <LogsPage />;
      case "gis":       return <GISPage />;
      case "dashboard": return <DashboardPage />;
      default:          return <ChatPage />;
    }
  };

  return (
    <div style={styles.root}>
      <Sidebar activeView={activeView} onViewChange={setActiveView} onQuickTopic={handleQuickTopic} />
      <main style={styles.main}>{renderPage()}</main>
    </div>
  );
}

const styles = {
  root: { display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-base)" },
  main: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" },
};
