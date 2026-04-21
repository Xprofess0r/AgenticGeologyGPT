const BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Stable session ID per browser tab
let _sessionId = null;
export function getSessionId() {
  if (!_sessionId) {
    _sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }
  return _sessionId;
}

/**
 * Send chat messages through the agentic pipeline.
 * Returns: { reply, sources, confidence, route, evaluation, steps, runId }
 */
export async function sendChatMessage(messages) {
  const res = await fetch(`${BASE}/api/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, sessionId: getSessionId() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  return res.json();
}

/** Clear server-side session memory */
export async function resetSession() {
  await fetch(`${BASE}/api/chat/session/reset`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: getSessionId() }),
  });
  _sessionId = null; // reset client session too
}

/** Notes explainer */
export async function explainNotes(text) {
  const res = await fetch(`${BASE}/api/explain`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  const data = await res.json();
  return data.explanation;
}

/** Upload PDF with progress */
export async function uploadPDF(file, onProgress) {
  const formData = new FormData();
  formData.append("pdf", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/api/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || "Upload failed"));
      } catch {
        reject(new Error("Invalid server response"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error — is the server running?"));
    xhr.send(formData);
  });
}

/** Fetch recent agent run logs */
export async function fetchLogs(n = 20) {
  const res = await fetch(`${BASE}/api/logs?n=${n}`);
  if (!res.ok) throw new Error("Failed to fetch logs");
  return res.json();
}
