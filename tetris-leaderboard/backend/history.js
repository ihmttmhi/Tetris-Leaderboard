// backend/history.js
// Tracks weekly leaderboard-position snapshots so the frontend can show
// per-player movement arrows and a "last week" recap.
//
// Storage: a single history.json file kept on a dedicated git branch
// (default "leaderboard-data") via the GitHub Contents API, so it survives
// Render redeploys (which wipe the local filesystem). When no GITHUB_TOKEN is
// configured it falls back to a local file that resets on redeploy.

const fs = require("fs");
const path = require("path");
const axios = require("axios");

function safeErrorMsg(err) {
  // Avoid leaking Authorization headers in logs
  return err.response?.status
    ? `HTTP ${err.response.status}`
    : err.message || "Unknown error";
}

const TZ = process.env.WEEK_TZ || "America/Toronto";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "athletictrack/Tetris-Leaderboard";
const DATA_BRANCH = process.env.HISTORY_BRANCH || "leaderboard-data";
const DATA_PATH = process.env.HISTORY_PATH || "history.json";
const LOCAL_FILE = path.join(__dirname, "history.local.json");
const MAX_SNAPSHOTS = 8;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let snapshots = []; // [{ weekStart: "YYYY-MM-DD", ranks: {user:rank}, names: {user:realName}, letterRanks?: {user:rank} }]
let remoteSha = null; // sha of history.json on the data branch (for updates)
let loaded = false;
let persisting = false;

// ----- time helpers -----

function torontoParts(date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    weekday: parts.weekday,
  };
}

// Returns the date (YYYY-MM-DD) of the most recent Sunday 00:00 in TZ.
function weekStartKey(date = new Date()) {
  const p = torontoParts(date);
  const dayIndex = WEEKDAYS.indexOf(p.weekday);
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day));
  base.setUTCDate(base.getUTCDate() - dayIndex);
  return base.toISOString().slice(0, 10);
}

// ----- GitHub persistence -----

function ghHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "tetris-leaderboard",
  };
}

async function ensureBranch() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/git/refs/heads/${DATA_BRANCH}`;
  try {
    await axios.get(url, { headers: ghHeaders() });
    return; // branch exists
  } catch (err) {
    if (err.response?.status !== 404) throw err;
  }
  // create the branch off the default branch HEAD
  const repo = await axios.get(`https://api.github.com/repos/${GITHUB_REPO}`, {
    headers: ghHeaders(),
  });
  const base = repo.data.default_branch;
  const baseRef = await axios.get(
    `https://api.github.com/repos/${GITHUB_REPO}/git/refs/heads/${base}`,
    { headers: ghHeaders() }
  );
  await axios.post(
    `https://api.github.com/repos/${GITHUB_REPO}/git/refs`,
    { ref: `refs/heads/${DATA_BRANCH}`, sha: baseRef.data.object.sha },
    { headers: ghHeaders() }
  );
  console.log(`Created data branch ${DATA_BRANCH}`);
}

async function loadFromGitHub() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(
    DATA_PATH
  )}?ref=${DATA_BRANCH}`;
  try {
    const res = await axios.get(url, { headers: ghHeaders() });
    remoteSha = res.data.sha;
    const json = Buffer.from(res.data.content, "base64").toString("utf-8");
    snapshots = JSON.parse(json);
    console.log(`Loaded ${snapshots.length} weekly snapshot(s) from GitHub`);
  } catch (err) {
    if (err.response?.status === 404) {
      console.log("No history.json on data branch yet; starting fresh");
      snapshots = [];
      remoteSha = null;
    } else {
      throw err;
    }
  }
}

async function saveToGitHub() {
  await ensureBranch();
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(
    DATA_PATH
  )}`;
  const content = Buffer.from(JSON.stringify(snapshots, null, 2)).toString("base64");
  const body = {
    message: `Update leaderboard history (${weekStartKey()})`,
    content,
    branch: DATA_BRANCH,
  };
  if (remoteSha) body.sha = remoteSha;

  try {
    const res = await axios.put(url, body, { headers: ghHeaders() });
    remoteSha = res.data.content.sha;
    console.log("Saved leaderboard history to GitHub");
  } catch (err) {
    if (err.response?.status === 409) {
      // SHA conflict — refetch the latest SHA and retry once
      console.warn("SHA conflict saving history; refetching and retrying...");
      const getRes = await axios.get(`${url}?ref=${DATA_BRANCH}`, {
        headers: ghHeaders(),
      });
      remoteSha = getRes.data.sha;
      body.sha = remoteSha;
      const retryRes = await axios.put(url, body, { headers: ghHeaders() });
      remoteSha = retryRes.data.content.sha;
      console.log("Saved leaderboard history to GitHub (after conflict retry)");
    } else {
      throw err;
    }
  }
}

// ----- local fallback -----

function loadLocal() {
  try {
    snapshots = JSON.parse(fs.readFileSync(LOCAL_FILE, "utf-8"));
    console.log(`Loaded ${snapshots.length} weekly snapshot(s) from local file`);
  } catch (err) {
    console.warn("Could not load local history (starting fresh):", err.message);
    snapshots = [];
  }
}

function saveLocal() {
  try {
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(snapshots, null, 2));
  } catch (err) {
    console.error("Failed to write local history:", err.message);
  }
}

let persistQueued = false;

async function persist() {
  if (persisting) {
    persistQueued = true;
    return;
  }
  persisting = true;
  try {
    if (GITHUB_TOKEN) await saveToGitHub();
    else saveLocal();
  } catch (err) {
    console.error(
      "Failed to persist history:",
      safeErrorMsg(err),
      "— data may be lost on restart"
    );
  } finally {
    persisting = false;
    if (persistQueued) {
      persistQueued = false;
      persist();
    }
  }
}

// ----- public API -----

async function init() {
  try {
    if (GITHUB_TOKEN) await loadFromGitHub();
    else loadLocal();
  } catch (err) {
    console.error("Failed to load history:", safeErrorMsg(err));
    snapshots = [];
  }
  loaded = true;
}

// Take a new weekly snapshot if we've crossed into a new week (TZ Sunday 00:00).
function maybeRollover(currentRanks, currentNames, currentLetterRanks) {
  if (!loaded) return;
  const week = weekStartKey();
  const last = snapshots[snapshots.length - 1];
  if (last && last.weekStart >= week) return;
  snapshots.push({
    weekStart: week,
    ranks: { ...currentRanks },
    names: { ...currentNames },
    letterRanks: { ...currentLetterRanks },
  });
  if (snapshots.length > MAX_SNAPSHOTS) {
    snapshots = snapshots.slice(snapshots.length - MAX_SNAPSHOTS);
  }
  persist(); // fire and forget
}

// Ranks at the start of the current week (baseline for live arrows).
function getBaselineRanks() {
  const last = snapshots[snapshots.length - 1];
  return last ? last.ranks : {};
}

// The date (YYYY-MM-DD) the current live comparison is measured against, i.e.
// the start of the current week. Null until a real baseline exists.
function getBaselineWeek() {
  if (!hasBaseline()) return null;
  const last = snapshots[snapshots.length - 1];
  return last ? last.weekStart : null;
}

// Whether we have a genuine start-of-week baseline to compare against.
// The very first snapshot is taken mid-week (when the feature first runs), so
// it isn't a real week boundary; movement is only meaningful once a Sunday
// rollover has produced a second snapshot. Until then everyone shows "new".
function hasBaseline() {
  return snapshots.length >= 2;
}

// Movement of a player's current rank vs the start-of-week baseline.
function getMovement(username, currentRank) {
  if (!hasBaseline()) return { dir: "new", delta: 0 };
  const baseline = getBaselineRanks()[username];
  if (baseline == null) return { dir: "new", delta: 0 };
  const delta = baseline - currentRank; // positive => moved up
  return {
    dir: delta > 0 ? "up" : delta < 0 ? "down" : "same",
    delta: Math.abs(delta),
  };
}

// Best (lowest-numbered) rank a player has ever held across all snapshots.
function getBestRank(username) {
  let best = null;
  for (const s of snapshots) {
    const r = s.ranks[username];
    if (r != null && (best == null || r < best)) best = r;
  }
  return best;
}

// TETR.IO letter rank ordering (lowest to highest).
const RANK_ORDER = [
  "d", "d+", "c-", "c", "c+", "b-", "b", "b+",
  "a-", "a", "a+", "s-", "s", "s+", "ss", "u", "x", "x+",
];
function rankIndex(r) {
  if (!r) return -1;
  return RANK_ORDER.indexOf(r.toLowerCase().trim());
}

// Best (highest) letter rank a player has ever held across all snapshots.
function getBestLetterRank(username) {
  let best = -1;
  for (const s of snapshots) {
    if (!s.letterRanks) continue;
    const idx = rankIndex(s.letterRanks[username]);
    if (idx > best) best = idx;
  }
  return best;
}

// Top-of-page highlights derived from the live (sorted) member list:
// biggest climbers/drops this week and players hitting a new personal-best rank.
function getHighlights(list) {
  const mapMover = (m) => ({
    username: m.username,
    realName: m.realName,
    delta: m.move.delta,
    rank: m.clubRank,
  });

  const climbers = list
    .filter((m) => m.move && m.move.dir === "up")
    .sort((a, b) => b.move.delta - a.move.delta)
    .slice(0, 3)
    .map(mapMover);

  const fallers = list
    .filter((m) => m.move && m.move.dir === "down")
    .sort((a, b) => b.move.delta - a.move.delta)
    .slice(0, 3)
    .map(mapMover);

  // Only meaningful once we have prior weeks to compare against.
  let newPeaks = [];
  if (snapshots.length >= 2) {
    newPeaks = list
      .filter((m) => {
        const best = getBestRank(m.username);
        return best != null && m.clubRank < best;
      })
      .sort((a, b) => a.clubRank - b.clubRank)
      .map((m) => ({
        username: m.username,
        realName: m.realName,
        rank: m.clubRank,
      }));
  }

  // Players whose current TETR.IO letter rank is higher than any previously
  // recorded snapshot — i.e. they achieved a new rank since tracking began.
  let newRanks = [];
  if (snapshots.length >= 1) {
    newRanks = list
      .filter((m) => {
        const currentIdx = rankIndex(m.letterRank);
        if (currentIdx <= 0) return false; // unranked / unknown
        const bestIdx = getBestLetterRank(m.username);
        return bestIdx >= 0 && currentIdx > bestIdx;
      })
      .sort((a, b) => rankIndex(b.letterRank) - rankIndex(a.letterRank))
      .map((m) => ({
        username: m.username,
        realName: m.realName,
        newRank: m.letterRank,
      }));
  }

  return { climbers, fallers, newPeaks, newRanks };
}

// Recap of the most recently completed week (compare the two latest snapshots).
function getRecap() {
  if (snapshots.length < 2) return null;
  const prev = snapshots[snapshots.length - 2];
  const curr = snapshots[snapshots.length - 1];
  const movers = [];
  for (const username of Object.keys(curr.ranks)) {
    if (prev.ranks[username] == null) continue;
    const delta = prev.ranks[username] - curr.ranks[username];
    movers.push({
      username,
      realName: curr.names[username] || prev.names[username] || username,
      delta: Math.abs(delta),
      dir: delta > 0 ? "up" : delta < 0 ? "down" : "same",
    });
  }
  movers.sort((a, b) => b.delta - a.delta);
  return { weekFrom: prev.weekStart, weekTo: curr.weekStart, movers };
}

module.exports = {
  init,
  maybeRollover,
  getMovement,
  getRecap,
  getHighlights,
  getBaselineWeek,
  weekStartKey,
};
