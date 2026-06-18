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

const TZ = process.env.WEEK_TZ || "America/Toronto";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "athletictrack/Tetris-Leaderboard";
const DATA_BRANCH = process.env.HISTORY_BRANCH || "leaderboard-data";
const DATA_PATH = process.env.HISTORY_PATH || "history.json";
const LOCAL_FILE = path.join(__dirname, "history.local.json");
const MAX_SNAPSHOTS = 8;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let snapshots = []; // [{ weekStart: "YYYY-MM-DD", ranks: {user:rank}, names: {user:realName} }]
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
  const res = await axios.put(url, body, { headers: ghHeaders() });
  remoteSha = res.data.content.sha;
  console.log("Saved leaderboard history to GitHub");
}

// ----- local fallback -----

function loadLocal() {
  try {
    snapshots = JSON.parse(fs.readFileSync(LOCAL_FILE, "utf-8"));
    console.log(`Loaded ${snapshots.length} weekly snapshot(s) from local file`);
  } catch {
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

async function persist() {
  if (persisting) return;
  persisting = true;
  try {
    if (GITHUB_TOKEN) await saveToGitHub();
    else saveLocal();
  } catch (err) {
    console.error("Failed to persist history:", err.response?.status || err.message);
  } finally {
    persisting = false;
  }
}

// ----- public API -----

async function init() {
  try {
    if (GITHUB_TOKEN) await loadFromGitHub();
    else loadLocal();
  } catch (err) {
    console.error("Failed to load history:", err.response?.status || err.message);
    snapshots = [];
  }
  loaded = true;
}

// Take a new weekly snapshot if we've crossed into a new week (TZ Sunday 00:00).
function maybeRollover(currentRanks, currentNames) {
  if (!loaded) return;
  const week = weekStartKey();
  const last = snapshots[snapshots.length - 1];
  if (last && last.weekStart >= week) return;
  snapshots.push({
    weekStart: week,
    ranks: { ...currentRanks },
    names: { ...currentNames },
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

// Movement of a player's current rank vs the start-of-week baseline.
function getMovement(username, currentRank) {
  const baseline = getBaselineRanks()[username];
  if (baseline == null) return { dir: "new", delta: 0 };
  const delta = baseline - currentRank; // positive => moved up
  return {
    dir: delta > 0 ? "up" : delta < 0 ? "down" : "same",
    delta: Math.abs(delta),
  };
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
  weekStartKey,
};
