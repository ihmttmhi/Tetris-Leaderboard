import React, { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import Bracket from "./Bracket";

/* ---------------- LEADERBOARD ---------------- */

function Movement({ move }) {
  if (!move || move.dir === "new" || move.dir === "same") {
    const title = (!move || move.dir === "new") ? "New this week" : "No change since the start of the week";
    return (
      <span title={title} style={{ display: "inline-flex", alignItems: "center" }}>
        <img src="/icons/bar-same.svg" alt={title} height="10" style={{ verticalAlign: "middle" }} />
      </span>
    );
  }
  const up = move.dir === "up";
  return (
    <span
      title={`${up ? "Up" : "Down"} ${move.delta} since the start of the week`}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600, color: up ? "#2ecc71" : "#e74c3c" }}
    >
      <img
        src={up ? "/icons/arrow-up.svg" : "/icons/arrow-down.svg"}
        alt={up ? "Up" : "Down"}
        height="18"
      />
      {move.delta}
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

const fmtSprint = (ms) => {
  if (ms == null) return "\u2013";
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = (totalSec % 60).toFixed(3);
  return `${min}:${sec.padStart(6, "0")}`;
};
const fmtBlitz = (s) => (s == null ? "\u2013" : s.toLocaleString());
const fmtZenith = (a) => (a == null ? "\u2013" : `${a.toFixed(1)}m`);

function Highlights({ highlights, since }) {
  if (!highlights) return null;
  const {
    climbers = [], fallers = [], newPeaks = [], newRanks = [],
    newSprintPBs = [], newBlitzPBs = [], newZenithPBs = [],
  } = highlights;
  const hasAny = climbers.length || fallers.length || newPeaks.length ||
    newRanks.length || newSprintPBs.length || newBlitzPBs.length || newZenithPBs.length;
  if (!hasAny) return null;

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
      {newSprintPBs.length > 0 && (
        <div>
          ⏱ <strong>New 40L PB:</strong>{" "}
          {newSprintPBs.map((m, i) => (
            <span key={m.username}>
              {i > 0 && ", "}
              <strong>{m.realName}</strong> {fmtSprint(m.value)}
            </span>
          ))}
        </div>
      )}
      {newBlitzPBs.length > 0 && (
        <div>
          💥 <strong>New Blitz PB:</strong>{" "}
          {newBlitzPBs.map((m, i) => (
            <span key={m.username}>
              {i > 0 && ", "}
              <strong>{m.realName}</strong> {fmtBlitz(m.value)}
            </span>
          ))}
        </div>
      )}
      {newZenithPBs.length > 0 && (
        <div>
          🗼 <strong>New Quick Play PB:</strong>{" "}
          {newZenithPBs.map((m, i) => (
            <span key={m.username}>
              {i > 0 && ", "}
              <strong>{m.realName}</strong> {fmtZenith(m.value)}
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

const SORT_MODES = [
  { key: "tr", label: "TR" },
  { key: "sprint", label: "40L" },
  { key: "blitz", label: "Blitz" },
  { key: "zenith", label: "Quick Play" },
];

const MODE_COLUMNS = {
  tr: {
    headers: ["TR", "Letter Rank", "PPS", "APM", "VS", "Local", "World"],
    cells: (m, normalizeRank, fmtStanding) => [
      <td key="tr">{fmtTR(m)}</td>,
      <td key="lr"><img src={`/ranks/${normalizeRank(m.letterRank)}.png`} alt={m.letterRank} height="28" onError={(e) => { e.target.src = "/ranks/placeholder.png"; }} /></td>,
      <td key="pps">{m.pps}</td>,
      <td key="apm">{m.apm}</td>,
      <td key="vs">{m.vs}</td>,
      <td key="local">{fmtStanding(m.standing_local)}</td>,
      <td key="world">{fmtStanding(m.standing_world)}</td>,
    ],
  },
  sprint: {
    headers: ["40L Time"],
    cells: (m) => [<td key="sprint">{fmtSprint(m.sprint)}</td>],
  },
  blitz: {
    headers: ["Blitz Score"],
    cells: (m) => [<td key="blitz">{fmtBlitz(m.blitz)}</td>],
  },
  zenith: {
    headers: ["Quick Play", "Expert QP"],
    cells: (m) => [
      <td key="zenith">{fmtZenith(m.zenith)}</td>,
      <td key="zenithEx">{fmtZenith(m.zenithEx)}</td>,
    ],
  },
};

function sortMembers(list, mode) {
  const sorted = [...list];
  switch (mode) {
    case "sprint":
      sorted.sort((a, b) => {
        if (a.sprint == null && b.sprint == null) return 0;
        if (a.sprint == null) return 1;
        if (b.sprint == null) return -1;
        return a.sprint - b.sprint; // lower time = better
      });
      break;
    case "blitz":
      sorted.sort((a, b) => {
        if (a.blitz == null && b.blitz == null) return 0;
        if (a.blitz == null) return 1;
        if (b.blitz == null) return -1;
        return b.blitz - a.blitz; // higher score = better
      });
      break;
    case "zenith":
      sorted.sort((a, b) => {
        if (a.zenith == null && b.zenith == null) return 0;
        if (a.zenith == null) return 1;
        if (b.zenith == null) return -1;
        return b.zenith - a.zenith; // higher altitude = better
      });
      break;
    default: // "tr"
      sorted.sort((a, b) => b.tr - a.tr);
  }
  sorted.forEach((m, i) => { m.sortedRank = i + 1; });
  return sorted;
}

function Leaderboard({ members, searchTerm, setSearchTerm, recap, highlights, since, fetchError, sortMode, setSortMode }) {
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontWeight: 600 }}>Rank by:</span>
        {SORT_MODES.map((mode) => (
          <button
            key={mode.key}
            onClick={() => setSortMode(mode.key)}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: sortMode === mode.key ? "2px solid var(--link-color)" : "1px solid var(--table-border)",
              background: sortMode === mode.key ? "var(--link-color)" : "var(--table-header-bg)",
              color: sortMode === mode.key ? "#fff" : "var(--text-color)",
              fontWeight: sortMode === mode.key ? 700 : 400,
              cursor: "pointer",
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

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
            {MODE_COLUMNS[sortMode].headers.map((h) => <th key={h}>{h}</th>)}
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
              <td>{sortMode === "tr" ? (m.clubRank ?? i + 1) : (m.sortedRank ?? i + 1)}</td>
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

              {MODE_COLUMNS[sortMode].cells(m, normalizeRank, fmtStanding)}
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
      setRecap(data.recap || null);
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
              members={sortMembers(members, sortMode)}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              recap={recap}
              highlights={highlights}
              since={since}
              fetchError={fetchError}
              sortMode={sortMode}
              setSortMode={setSortMode}
            />
          }
        />

        <Route path="/bracket" element={<Bracket />} />
      </Routes>
    </div>
  );
}