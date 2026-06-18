import React, { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import Bracket from "./Bracket";

/* ---------------- LEADERBOARD ---------------- */

function Leaderboard({ members, searchTerm, setSearchTerm }) {
  const normalizeRank = (rank) => {
    if (!rank) return "placeholder";
    return rank.toLowerCase().replace("+", "plus").replace("-", "minus");
  };

  const filtered = members.filter((m) =>
    (m.username ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.realName ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <h1>UTS Tetris Elite Leaderboard</h1>

      <input
        placeholder="Search players..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          padding: "9px 12px",
          marginBottom: "15px",
          width: "320px",
          maxWidth: "100%",
          borderRadius: "8px",
          border: "1px solid var(--table-border)",
          background: "var(--table-header-bg)",
          color: "var(--text-color)"
        }}
      />

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "var(--table-header-bg)" }}>
          <tr>
            <th>Rank</th>
            <th>Real Name</th>
            <th>Username</th>
            <th>Grade</th>
            <th>Letter Rank</th>
            <th>TR</th>
            <th>PPS</th>
            <th>APM</th>
            <th>VS</th>
            <th>Local</th>
            <th>World</th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((m, i) => (
            <tr
              key={m.username}
              style={{
                background:
                  i % 2 === 0
                    ? "var(--table-row-even)"
                    : "var(--table-row-odd)"
              }}
            >
              <td>{i + 1}</td>
              <td>{m.realName}</td>

              <td>
                <a
                  href={`https://ch.tetr.io/u/${m.username}/league`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--link-color)",
                    textDecoration: "none"
                  }}
                >
                  {m.username}
                </a>
              </td>

              <td>{m.grade || "-"}</td>

              <td>
                <img
                  src={`/ranks/${normalizeRank(m.letterRank)}.png`}
                  alt={m.letterRank}
                  height="28"
                  onError={(e) => {
                    e.target.src = "/ranks/placeholder.png";
                  }}
                />
              </td>

              <td>{m.tr}</td>
              <td>{m.pps}</td>
              <td>{m.apm}</td>
              <td>{m.vs}</td>
              <td>{m.standing_local}</td>
              <td>{m.standing_world}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- APP ---------------- */

export default function App() {
  const [members, setMembers] = useState([]);
  const [darkMode, setDarkMode] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
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

    const fetchData = async () => {
      try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        setMembers(data.members || []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
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
              Leaderboard
            </button>
          </Link>

          <Link to="/bracket" style={{ textDecoration: "none" }}>
            <button style={tabStyle(location.pathname === "/bracket")}>
              Tournament Bracket
            </button>
          </Link>
        </div>

        {/* DARK MODE (checkbox LEFT of text) */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 10px",
            border: "1px solid var(--table-border)",
            borderRadius: "8px",
            background: "var(--table-header-bg)"
          }}
        >
          <input
            type="checkbox"
            checked={darkMode}
            onChange={() => setDarkMode((prev) => !prev)}
            style={{ cursor: "pointer" }}
          />
          <span style={{ fontSize: "14px" }}>
            {darkMode ? "Dark mode" : "Light mode"}
          </span>
        </label>
      </div>

      {/* ROUTES */}
      <Routes>
        <Route
          path="/"
          element={
            <Leaderboard
              members={members}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          }
        />

        <Route path="/bracket" element={<Bracket />} />
      </Routes>
    </div>
  );
}