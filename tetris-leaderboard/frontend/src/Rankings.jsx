import React, { useState } from "react";

/* ---------------- HELPERS ---------------- */

function Movement({ move }) {
  if (!move || move.dir === "new" || move.dir === "same") {
    const title = (!move || move.dir === "new") ? "New this week" : "No change in the last 7 days";
    return (
      <span title={title} style={{ display: "inline-flex", alignItems: "center" }}>
        <img src="/icons/bar-same.svg" alt={title} height="10" style={{ verticalAlign: "middle" }} />
      </span>
    );
  }
  const up = move.dir === "up";
  return (
    <span
      title={`${up ? "Up" : "Down"} ${move.delta} in the last 7 days`}
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

const fmtTimeAgo = (ts) => {
  if (!ts) return "";
  const diff = Date.now() - (typeof ts === "string" ? new Date(ts).getTime() : ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const normalizeRank = (rank) => {
  if (!rank) return "placeholder";
  return rank.toLowerCase().replace("+", "plus").replace("-", "minus");
};

function AchievementLine({ a }) {
  const profileUrl = `https://ch.tetr.io/u/${a.username}`;
  const nameLink = <a href={profileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>{a.username.toUpperCase()}</a>;
  switch (a.type) {
    case "rank":
      return <>{nameLink} achieved <img src={`/ranks/${normalizeRank(a.value)}.png`} alt={a.value.toUpperCase()} height="20" style={{ verticalAlign: "middle", margin: "0 4px" }} onError={(e) => { e.target.src = "/ranks/placeholder.png"; }} /> rank</>;
    case "sprint":
      return <>{nameLink} got a new personal best in 40 Lines with a time of {fmtSprint(a.value)}</>;
    case "blitz":
      return <>{nameLink} got a new personal best in Blitz with a score of {fmtBlitz(a.value)}</>;
    case "zenith":
      return <>{nameLink} got a new personal best in Quick Play with an altitude of {fmtZenith(a.value)}</>;
    case "zenithEx":
      return <>{nameLink} got a new personal best in Expert Quick Play with an altitude of {fmtZenith(a.value)}</>;
    default:
      return null;
  }
}

/* ---------------- NEWS HIGHLIGHTS ---------------- */

const INITIAL_NEWS_COUNT = 5;

function Highlights({ highlights }) {
  const [expanded, setExpanded] = useState(false);
  if (!highlights) return null;
  const { achievements = [] } = highlights;
  if (!achievements.length) return null;

  const visible = expanded ? achievements : achievements.slice(0, INITIAL_NEWS_COUNT);
  const hasMore = achievements.length > INITIAL_NEWS_COUNT;

  return (
    <div
      style={{
        margin: "10px 0 20px",
        padding: "16px 20px",
        border: "1px solid var(--table-border)",
        borderRadius: "12px",
        background: "linear-gradient(135deg, var(--table-header-bg), var(--table-row-even))",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: "1.05em", marginBottom: 4 }}>
        LATEST NEWS
      </div>
      {visible.map((a, i) => (
        <div key={`${a.username}-${a.type}-${a.ts}-${i}`} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontWeight: 500 }}><AchievementLine a={a} /></div>
          <div style={{ color: "var(--footer-color)", fontSize: "0.85em" }}>{fmtTimeAgo(a.ts)}</div>
        </div>
      ))}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "none",
            border: "1px solid var(--table-border)",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            color: "inherit",
            fontSize: "0.9em",
            alignSelf: "center",
            marginTop: 4,
          }}
        >
          {expanded ? "Show less" : `Show ${achievements.length - INITIAL_NEWS_COUNT} more`}
        </button>
      )}
    </div>
  );
}

/* ---------------- FORMATTERS ---------------- */

const isUnranked = (letterRank) => {
  const r = (letterRank ?? "").toString().toLowerCase().trim();
  return r === "" || r === "z" || r === "?" || r === "-";
};
const fmtTR = (m) => (isUnranked(m.letterRank) ? "Unranked" : Number(m.tr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtStanding = (s) => (s == null || s <= 0 ? "\u2013" : s.toLocaleString());
const fmtNum = (v, d = 2) => (v == null ? "\u2013" : Number(v).toFixed(d));
const fmtInt = (v) => (v == null ? "\u2013" : v.toLocaleString());
const fmtFinesse = (faults, pct) => {
  if (faults == null) return "\u2013";
  const p = pct != null ? `(${pct.toFixed(2)}%)` : "";
  return `${faults}F ${p}`;
};
const fmtClimb = (avg, peak) => {
  if (avg == null) return "\u2013";
  const p = peak != null ? ` (peak ${Math.floor(peak)})` : "";
  return `${avg.toFixed(2)}${p}`;
};
const fmtRecord = (won, played) => {
  if (!played) return "\u2013";
  const pct = ((won / played) * 100).toFixed(1);
  return `${won.toLocaleString()}/${played.toLocaleString()} (${pct}%)`;
};
const replayLink = (replayId) =>
  replayId ? `https://tetr.io/#R:${replayId}` : null;
const ReplayCell = ({ replayId, children }) => {
  const url = replayLink(replayId);
  if (!url) return <>{children}</>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--link-color)", textDecoration: "none" }}>
      {children}
    </a>
  );
};
const fmtTimeMM = (ms) => {
  if (ms == null) return "\u2013";
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = (totalSec % 60).toFixed(3);
  return `${min}:${sec.padStart(6, "0")}`;
};

/* ---------------- SORT & COLUMNS ---------------- */

const SORT_MODES = [
  { key: "tr", label: "TR" },
  { key: "sprint", label: "40L" },
  { key: "blitz", label: "Blitz" },
  { key: "zenith", label: "Quick Play" },
  { key: "zenithEx", label: "Expert QP" },
  { key: "zenithBest", label: "All-Time QP" },
];
const MODE_PROFILE_PATH = {
  tr: "/league",
  sprint: "/40l",
  blitz: "/blitz",
  zenith: "/zenith",
  zenithEx: "/zenithex",
  zenithBest: "/zenith",
};

const MODE_COLUMNS = {
  tr: {
    headers: ["Grade", "TR", "Letter Rank", "Record", "PPS", "APM", "VS", "World"],
    cells: (m, normalizeRank, fmtStanding) => [
      <td key="grade">{m.grade || "\u2013"}</td>,
      <td key="tr">{fmtTR(m)}</td>,
      <td key="letterRank"><img src={`/ranks/${normalizeRank(m.letterRank)}.png`} alt={m.letterRank} height="20" style={{ verticalAlign: "middle" }} onError={(e) => { e.target.src = "/ranks/placeholder.png"; }} /></td>,
      <td key="rec">{fmtRecord(m.gamesWon, m.gamesPlayed)}</td>,
      <td key="pps">{fmtNum(m.pps)}</td>,
      <td key="apm">{fmtNum(m.apm)}</td>,
      <td key="vs">{fmtNum(m.vs)}</td>,
      <td key="world">{fmtStanding(m.standing_world)}</td>,
    ],
  },
  sprint: {
    headers: ["Finesse", "KPP", "KPS", "Pieces", "PPS", "Time"],
    cells: (m) => [
      <td key="sfin">{fmtFinesse(m.sprintFinesseFaults, m.sprintFinessePct)}</td>,
      <td key="skpp">{fmtNum(m.sprintKPP)}</td>,
      <td key="skps">{fmtNum(m.sprintKPS)}</td>,
      <td key="spc">{fmtInt(m.sprintPieces)}</td>,
      <td key="spps">{fmtNum(m.sprintPPS)}</td>,
      <td key="sprint"><ReplayCell replayId={m.sprintReplayId}>{fmtSprint(m.sprint)}</ReplayCell></td>,
    ],
  },
  blitz: {
    headers: ["Finesse", "SPP", "Level", "Pieces", "PPS", "Score"],
    cells: (m) => [
      <td key="bfin">{fmtFinesse(m.blitzFinesseFaults, m.blitzFinessePct)}</td>,
      <td key="bspp">{fmtNum(m.blitzSPP)}</td>,
      <td key="blvl">{fmtInt(m.blitzLevel)}</td>,
      <td key="bpc">{fmtInt(m.blitzPieces)}</td>,
      <td key="bpps">{fmtNum(m.blitzPPS)}</td>,
      <td key="blitz"><ReplayCell replayId={m.blitzReplayId}>{fmtBlitz(m.blitz)}</ReplayCell></td>,
    ],
  },
  zenith: {
    headers: ["Time", "KOs", "Climb Speed", "APM", "PPS", "Altitude"],
    cells: (m) => [
      <td key="ztime">{fmtTimeMM(m.zenithTime)}</td>,
      <td key="zkos">{fmtInt(m.zenithKOs)}</td>,
      <td key="zclimb">{fmtClimb(m.zenithClimbAvg, m.zenithClimbPeak)}</td>,
      <td key="zapm">{fmtNum(m.zenithAPM)}</td>,
      <td key="zpps">{fmtNum(m.zenithPPS)}</td>,
      <td key="zenith"><ReplayCell replayId={m.zenithReplayId}>{fmtZenith(m.zenith)}</ReplayCell></td>,
    ],
  },
  zenithEx: {
    headers: ["Time", "KOs", "Climb Speed", "APM", "PPS", "Altitude"],
    cells: (m) => [
      <td key="zetime">{fmtTimeMM(m.zenithExTime)}</td>,
      <td key="zekos">{fmtInt(m.zenithExKOs)}</td>,
      <td key="zeclimb">{fmtClimb(m.zenithExClimbAvg, m.zenithExClimbPeak)}</td>,
      <td key="zeapm">{fmtNum(m.zenithExAPM)}</td>,
      <td key="zepps">{fmtNum(m.zenithExPPS)}</td>,
      <td key="zenithEx"><ReplayCell replayId={m.zenithExReplayId}>{fmtZenith(m.zenithEx)}</ReplayCell></td>,
    ],
  },
  zenithBest: {
    headers: ["QP All-Time", "Expert All-Time"],
    cells: (m) => [
      <td key="zbest">{fmtZenith(m.zenithBest)}</td>,
      <td key="zebest">{fmtZenith(m.zenithExBest)}</td>,
    ],
  },
};

/* ---------------- RANKINGS COMPONENT ---------------- */

export default function Rankings({ members, searchTerm, setSearchTerm, highlights, since, fetchError, sortMode, setSortMode }) {
  const filtered = members.filter((m) =>
    (m.username ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.realName ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <h1 style={{ fontSize: "2.2em", letterSpacing: "-0.02em", marginBottom: 16 }}>UTS Tetris Elite Leaderboard</h1>

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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontWeight: 600, fontSize: "0.9em", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--footer-color)" }}>Rank by:</span>
        {SORT_MODES.map((mode) => (
          <button
            key={mode.key}
            onClick={() => setSortMode(mode.key)}
            style={{
              padding: "7px 16px",
              borderRadius: "20px",
              border: sortMode === mode.key ? "2px solid var(--link-color)" : "1px solid var(--table-border)",
              background: sortMode === mode.key ? "var(--link-color)" : "transparent",
              color: sortMode === mode.key ? "#fff" : "var(--text-color)",
              fontWeight: sortMode === mode.key ? 700 : 400,
              cursor: "pointer",
              fontSize: "0.9em",
              transition: "all 0.15s",
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

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 2px" }}>
          <thead>
            <tr style={{ background: "var(--table-header-bg)" }}>
              <th style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.85em", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--table-border)" }}>Rank</th>
              {sortMode === "tr" && <th style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.85em", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--table-border)" }}>
                Change{since && <div style={{ fontSize: "0.7em", fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--footer-color)", marginTop: 2 }}>since {fmtDate(since)}</div>}
              </th>}
              <th style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.85em", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--table-border)" }}>Player</th>
              <th style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.85em", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--table-border)" }}>Username</th>
              {MODE_COLUMNS[sortMode].headers.map((h) => <th key={h} style={{ padding: "10px 8px", textAlign: "center", fontSize: "0.85em", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--table-border)" }}>{h}</th>)}
            </tr>
          </thead>

          <tbody>
            {filtered.map((m, i) => (
              <tr
                key={m.username}
                style={{
                  background: i % 2 === 0 ? "var(--table-row-even)" : "var(--table-row-odd)",
                }}
              >
                <td style={{ padding: "8px", fontWeight: 700, color: "var(--footer-color)", textAlign: "center" }}>{sortMode === "tr" ? (m.clubRank ?? i + 1) : (m.sortedRank ?? i + 1)}</td>
                {sortMode === "tr" && <td style={{ padding: "8px", textAlign: "center" }}><Movement move={m.move} /></td>}
                <td style={{ padding: "8px", fontWeight: 500, textAlign: "center" }}>{m.realName}</td>
                <td style={{ padding: "8px", textAlign: "center" }}>
                  <a
                    href={`https://ch.tetr.io/u/${m.username}${MODE_PROFILE_PATH[sortMode] || ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--link-color)", textDecoration: "none" }}
                  >
                    {m.username}
                  </a>
                </td>
                {MODE_COLUMNS[sortMode].cells(m, normalizeRank, fmtStanding).map((cell) => (
                  React.cloneElement(cell, { style: { ...cell.props.style, padding: "8px", textAlign: "center" } })
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
