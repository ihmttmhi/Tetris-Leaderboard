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

  useEffect(() => {
    applyMode(darkMode);

    const applyData = (data) => {
      setMembers(data.members || []);
      setHighlights(data.highlights || null);
      setSince(data.since || null);
      setFetchError(null);
    };

    // Use SSE for real-time per-player updates; fall back to polling on error
    const es = new EventSource("/api/leaderboard/stream");
    es.onmessage = (event) => {
      try {
        applyData(JSON.parse(event.data));
      } catch (err) {
        console.error("Failed to parse SSE data:", err);
      }
    };
    es.onerror = () => {
      setFetchError("Live connection lost — retrying...");
    };

    return () => es.close();
  }, [darkMode]);

  const tabStyle = (active) => ({
    padding: "8px 14px",
    borderRadius: "10px",
    border: "1px solid var(--table-border)",
    background: active ? "var(--link-color)" : "var(--table-header-bg)",
    color: active ? "#fff" : "var(--text-color)",
    cursor: "pointer"
  });

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
