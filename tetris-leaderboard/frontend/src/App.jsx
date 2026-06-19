import React, { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import Bracket from "./Bracket";

/* ---------------- LEADERBOARD ---------------- */

function Movement({ move }) {
  if (!move || move.dir === "new") {
    return (
      <span title="New this week" style={{ color: "var(--footer-color)" }}>
        –
      </span>
    );
  }
  if (move.dir === "same") {
    return (
      <span
        title="No change since the start of the week"
        style={{
          display: "inline-block",
          width: 16,
          height: 4,
          borderRadius: 2,
          background: "#9e9e9e",
          verticalAlign: "middle"
        }}
      />
    );
  }
  const up = move.dir === "up";
  return (
    <span
      title={`${up ? "Up" : "Down"} ${move.delta} since the start of the week`}
      style={{ color: up ? "#2ecc71" : "#e74c3c", fontWeight: 600 }}
    >
      {up ? "\u25B2" : "\u25BC"} {move.delta}
    </span>
  );
}

function Recap({ recap }) {
  if (!recap || !recap.movers || recap.movers.length === 0) return null;
  const moved = recap.movers.filter((m) => m.dir !== "same");
  if (moved.length === 0) return null;

  return (
    <div
      style={{
        margin: "10px 0 20px",
        padding: "14px 16px",
        border: "1px solid var(--table-border)",
        borderRadius: "10px",
        background: "var(--table-header-bg)"
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        📊 Last week's recap{" "}
        <span style={{ fontWeight: 400, color: "var(--footer-color)" }}>
          (week of {recap.weekFrom})
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px" }}>
        {moved.map((m) => {
          const up = m.dir === "up";
          return (
            <span key={m.username}>
              <strong>{m.realName}</strong>{" "}
              <span style={{ color: up ? "#2ecc71" : "#e74c3c", fontWeight: 600 }}>
                {up ? "\u25B2" : "\u25BC"} {m.delta}
              </span>{" "}
              position{m.delta === 1 ? "" : "s"} {up ? "up" : "down"}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Format a YYYY-MM-DD week key into a readable date (e.g. "Jun 8, 2026").
const fmtDate = (key) => {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

function Highlights({ highlights, since }) {
  if (!highlights) return null;
  const { climbers = [], fallers = [], newPeaks = [], newRanks = [] } = highlights;
  if (!climbers.length && !fallers.length && !newPeaks.length && !newRanks.length) return null;

  const movers = (arr, up) =>
    arr.map((m, i) => (
      <span key={m.username}>
        {i > 0 && ", "}
        <strong>{m.realName}</strong>{" "}
        <span style={{ color: up ? "#2ecc71" : "#e74c3c", fontWeight: 600 }}>
          {up ? "\u25B2" : "\u25BC"}{m.delta}
        </span>
      </span>
    ));

  return (
    <div
      style={{
        margin: "10px 0",
        padding: "14px 16px",
        border: "1px solid var(--table-border)",
        borderRadius: "10px",
        background: "var(--table-header-bg)",
        display: "flex",
        flexDirection: "column",
        gap: 6
      }}
    >
      <div style={{ fontWeight: 700 }}>
        ✨ {since ? `Changes since ${fmtDate(since)}` : "This week's highlights"}
      </div>
      {newRanks.length > 0 && (
        <div>
          🏆 <strong>New rank achieved:</strong>{" "}
          {newRanks.map((m, i) => (
            <span key={m.username}>
              {i > 0 && ", "}
              <strong>{m.realName}</strong> reached{" "}
              <span style={{ fontWeight: 700, textTransform: "uppercase" }}>
                {m.newRank}
              </span>
            </span>
          ))}
        </div>
      )}
      {climbers.length > 0 && (
        <div>🚀 <strong>Top climbers:</strong> {movers(climbers, true)}</div>
      )}
      {fallers.length > 0 && (
        <div>📉 <strong>Biggest drops:</strong> {movers(fallers, false)}</div>
      )}
      {newPeaks.length > 0 && (
        <div>
          🏅 <strong>New personal best:</strong>{" "}
          {newPeaks.map((m, i) => (
            <span key={m.username}>
              {i > 0 && ", "}
              <strong>{m.realName}</strong> reached #{m.rank}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// tetr.io marks unranked players with a "z" (unranked) or "?" letter rank.
const isUnranked = (letterRank) => {
  const r = (letterRank ?? "").toString().toLowerCase().trim();
  return r === "" || r === "z" || r === "?" || r === "-";
};
const fmtTR = (m) => (isUnranked(m.letterRank) ? "Unranked" : m.tr);
const fmtStanding = (s) => (s == null || s <= 0 ? "\u2013" : s.toLocaleString());

function Leaderboard({ members, searchTerm, setSearchTerm, recap, highlights, since, fetchError }) {
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

      {fetchError && (
        <div
          style={{
            margin: "10px 0",
            padding: "10px 14px",
            border: "1px solid #e74c3c",
            borderRadius: "8px",
            background: "rgba(231, 76, 60, 0.1)",
            color: "#e74c3c",
          }}
        >
          ⚠ Unable to refresh leaderboard: {fetchError}
        </div>
      )}

      <Highlights highlights={highlights} since={since} />
      <Recap recap={recap} />

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
            <th>Change</th>
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
              <td>{m.clubRank ?? i + 1}</td>
              <td><Movement move={m.move} /></td>
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

              <td>{fmtTR(m)}</td>
              <td>{m.pps}</td>
              <td>{m.apm}</td>
              <td>{m.vs}</td>
              <td>{fmtStanding(m.standing_local)}</td>
              <td>{fmtStanding(m.standing_world)}</td>
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
  const [recap, setRecap] = useState(null);
  const [highlights, setHighlights] = useState(null);
  const [since, setSince] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [fetchError, setFetchError] = useState(null);
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

    let pollDelay = 5000;      // normal interval (twice as fast)
    const MAX_DELAY = 120000;  // max 2 minutes on repeated errors

    const fetchData = async () => {
      try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        const data = await res.json();
        setMembers(data.members || []);
        setRecap(data.recap || null);
        setHighlights(data.highlights || null);
        setSince(data.since || null);
        setFetchError(null);
        pollDelay = 5000; // reset on success
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
        setFetchError(err.message || "Failed to load leaderboard data");
        pollDelay = Math.min(pollDelay * 2, MAX_DELAY); // exponential backoff
      }
      timeoutId = setTimeout(fetchData, pollDelay);
    };

    let timeoutId;
    fetchData();
    return () => clearTimeout(timeoutId);
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
              recap={recap}
              highlights={highlights}
              since={since}
              fetchError={fetchError}
            />
          }
        />

        <Route path="/bracket" element={<Bracket />} />
      </Routes>
    </div>
  );
}