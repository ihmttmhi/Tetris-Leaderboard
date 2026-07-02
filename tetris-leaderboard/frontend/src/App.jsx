import React, { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import Bracket from "./Bracket";
import Resources from "./Resources";
import Compare from "./Compare";
import Home from "./Home";
import Rankings from "./Rankings";
import sortMembers from "./sortMembers";

/* ---------------- APP SHELL ---------------- */

export default function App() {
  const [members, setMembers] = useState([]);
  const [highlights, setHighlights] = useState(null);
  const [since, setSince] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [fetchError, setFetchError] = useState(null);
  const [connectionBlocked, setConnectionBlocked] = useState(null);
  const [sortMode, setSortMode] = useState("tr");
  const location = useLocation();

  const applyMode = (dark) => {
    const root = document.documentElement;

    if (dark) {
      root.style.setProperty("--bg-color", "#121212");
      root.style.setProperty("--text-color", "#e0e0e0");
      root.style.setProperty("--table-header-bg", "#1f1f1f");
      root.style.setProperty("--table-row-even", "#1a1a1a");
      root.style.setProperty("--table-row-odd", "#222");
      root.style.setProperty("--table-border", "#444");
      root.style.setProperty("--link-color", "#4ea3ff");
      root.style.setProperty("--footer-color", "#888");
    } else {
      root.style.setProperty("--bg-color", "#ffffff");
      root.style.setProperty("--text-color", "#121212");
      root.style.setProperty("--table-header-bg", "#f0f0f0");
      root.style.setProperty("--table-row-even", "#fafafa");
      root.style.setProperty("--table-row-odd", "#ffffff");
      root.style.setProperty("--table-border", "#ccc");
      root.style.setProperty("--link-color", "#1a73e8");
      root.style.setProperty("--footer-color", "#555");
    }
  };

  // Apply the color theme whenever dark mode toggles.
  useEffect(() => {
    applyMode(darkMode);
  }, [darkMode]);

  // Open exactly one live leaderboard connection per browser.
  // The Web Locks API guarantees only one tab/window in this browser holds
  // the "live tab" lock at a time; other tabs show a friendly message. The
  // lock releases automatically when the holding tab closes or refreshes, so
  // a refresh seamlessly re-acquires it (with a short retry to cover the tiny
  // release/re-acquire window). The server-side per-IP cap remains only as a
  // DoS guard for shared networks.
  useEffect(() => {
    let es = null;
    let releaseLock = null;
    let cancelled = false;

    const applyData = (data) => {
      setMembers(data.members || []);
      setHighlights(data.highlights || null);
      setSince(data.since || null);
      setFetchError(null);
    };

    const startStream = () => {
      es = new EventSource("/api/leaderboard/stream");
      es.onmessage = (event) => {
        try {
          applyData(JSON.parse(event.data));
        } catch (err) {
          console.error("Failed to parse SSE data:", err);
        }
      };
      es.addEventListener("connection_error", (event) => {
        try {
          const { error } = JSON.parse(event.data);
          setConnectionBlocked(error);
        } catch {
          setConnectionBlocked("Too many connections. Please try again later.");
        }
        es.close();
      });
      es.onerror = () => {
        setFetchError("Live connection lost — retrying...");
      };
    };

    const LOCK_NAME = "leaderboard-live-tab";
    const MAX_ATTEMPTS = 5;
    const RETRY_DELAY_MS = 150;

    const tryAcquire = (attempt) => {
      if (cancelled) return;
      navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        if (cancelled) return undefined;
        if (!lock) {
          // Lock held by another tab. Retry a few times to tolerate the brief
          // window during a same-tab refresh; if it stays held, it's a real
          // second tab, so show the message.
          if (attempt < MAX_ATTEMPTS) {
            setTimeout(() => tryAcquire(attempt + 1), RETRY_DELAY_MS);
            return undefined;
          }
          setConnectionBlocked(
            "The leaderboard is already open in another tab in this browser. Please switch to that tab, or close it and click Retry."
          );
          return undefined;
        }
        // We hold the lock. Keep it by holding the promise open until unmount.
        startStream();
        return new Promise((resolve) => {
          releaseLock = resolve;
        });
      });
    };

    if (navigator.locks && navigator.locks.request) {
      tryAcquire(1);
    } else {
      // Browser without Web Locks support: fall back to the server-side cap.
      startStream();
    }

    return () => {
      cancelled = true;
      if (es) es.close();
      if (releaseLock) releaseLock();
    };
  }, []);

  const tabStyle = (active) => ({
    padding: "8px 14px",
    borderRadius: "10px",
    border: "1px solid var(--table-border)",
    background: active ? "var(--link-color)" : "var(--table-header-bg)",
    color: active ? "#fff" : "var(--text-color)",
    cursor: "pointer"
  });

  if (connectionBlocked) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--bg-color)",
          color: "var(--text-color)",
          padding: 40,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "3em", marginBottom: 20 }}>&#x26A0;</div>
        <h1 style={{ fontSize: "1.5em", marginBottom: 12 }}>Connection Limit Reached</h1>
        <p style={{ fontSize: "1.1em", maxWidth: 500, lineHeight: 1.6, color: "var(--footer-color)" }}>
          {connectionBlocked}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 24,
            padding: "10px 20px",
            borderRadius: 10,
            border: "1px solid var(--table-border)",
            background: "var(--link-color)",
            color: "#fff",
            cursor: "pointer",
            fontSize: "1em",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 20,
        background: "var(--bg-color)",
        color: "var(--text-color)",
        minHeight: "100vh"
      }}
    >
      {/* TOP BAR */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20
        }}
      >
        {/* TABS */}
        <div style={{ display: "flex", gap: "10px" }}>
          <Link to="/" style={{ textDecoration: "none" }}>
            <button style={tabStyle(location.pathname === "/")}>
              Home
            </button>
          </Link>

          <Link to="/rankings" style={{ textDecoration: "none" }}>
            <button style={tabStyle(location.pathname === "/rankings")}>
              Rankings
            </button>
          </Link>

          <Link to="/compare" style={{ textDecoration: "none" }}>
            <button style={tabStyle(location.pathname === "/compare")}>
              Compare
            </button>
          </Link>

          <Link to="/resources" style={{ textDecoration: "none" }}>
            <button style={tabStyle(location.pathname === "/resources")}>
              Resources
            </button>
          </Link>
        </div>

        {/* DARK MODE TOGGLE (four.lol style SVG icon) */}
        <button
          onClick={() => setDarkMode((prev) => !prev)}
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            background: darkMode ? "#ffffff" : "#1a1a2e",
            border: "none",
            cursor: "pointer",
            padding: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            width: 34,
            height: 34,
          }}
        >
          {darkMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#1a1a2e" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>

      {/* ROUTES */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/rankings"
          element={
            <Rankings
              members={sortMembers(members, sortMode)}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              highlights={highlights}
              since={since}
              fetchError={fetchError}
              sortMode={sortMode}
              setSortMode={setSortMode}
            />
          }
        />

        <Route path="/bracket" element={<Bracket />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/compare" element={<Compare members={members} darkMode={darkMode} />} />
      </Routes>
    </div>
  );
}
