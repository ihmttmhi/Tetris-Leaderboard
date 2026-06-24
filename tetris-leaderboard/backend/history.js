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
const GITHUB_REPO = process.env.GITHUB_REPO || "ihmttmhi/Tetris-Leaderboard";
const DATA_BRANCH = process.env.HISTORY_BRANCH || "leaderboard-data";
const DATA_PATH = process.env.HISTORY_PATH || "history.json";
const LOCAL_FILE = path.join(__dirname, "history.local.json");
const MAX_SNAPSHOT_AGE_DAYS = 30; // delete snapshots older than 30 days

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let snapshots = []; // [{ weekStart, ranks, names, letterRanks?, bestSprints?, bestBlitz?, bestZenith? }]
let remoteSha = null; // sha of history.json on the data branch (for updates)
let loaded = false;
let persisting = false;

// News from TETR.IO news API — fetched periodically, not self-detected
const NEWS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // show last 7 days
const NEWS_FETCH_INTERVAL_MS = 5 * 60 * 1000; // refresh every 5 minutes
let cachedNews = []; // [{ username, realName, type, value, ts, replayId? }]
let userIdCache = {}; // { username: tetrio_user_id }
let lastNewsFetch = 0;
let newsFetching = false;
const USER_AGENT = "TetrisLeaderboard/1.0 (https://github.com/ihmttmhi/Tetris-Leaderboard)";

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

// Returns the date (YYYY-MM-DD) of the most recent Monday 00:00 in TZ.
function weekStartKey(date = new Date()) {
  const p = torontoParts(date);
  const dayIndex = WEEKDAYS.indexOf(p.weekday);
  // Shift so Monday=0: (dayIndex + 6) % 7 gives days since last Monday
  const daysSinceMonday = (dayIndex + 6) % 7;
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day));
  base.setUTCDate(base.getUTCDate() - daysSinceMonday);
  return base.toISOString().slice(0, 10);
}

// Returns today's date (YYYY-MM-DD) in TZ — used as the daily snapshot key.
function dayKey(date = new Date()) {
  const p = torontoParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// Returns the date (YYYY-MM-DD) that is N calendar days ago in Toronto time.
function daysAgoKey(n) {
  const p = torontoParts(new Date());
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
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
    const data = JSON.parse(json);
    if (Array.isArray(data)) {
      snapshots = data;
    } else {
      snapshots = data.snapshots || [];
    }
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
  const persistData = { snapshots };
  const content = Buffer.from(JSON.stringify(persistData, null, 2)).toString("base64");
  const body = {
    message: `Update leaderboard history (${dayKey()})`,
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
    const data = JSON.parse(fs.readFileSync(LOCAL_FILE, "utf-8"));
    if (Array.isArray(data)) {
      snapshots = data;
    } else {
      snapshots = data.snapshots || [];
    }
    console.log(`Loaded ${snapshots.length} weekly snapshot(s) from local file`);
  } catch (err) {
    console.warn("Could not load local history (starting fresh):", err.message);
    snapshots = [];
  }
}

function saveLocal() {
  try {
    const persistData = { snapshots };
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(persistData, null, 2));
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

// ----- snapshot pruning -----

// Remove snapshots whose date key is more than MAX_SNAPSHOT_AGE_DAYS old.
function pruneOldSnapshots() {
  const cutoff = daysAgoKey(MAX_SNAPSHOT_AGE_DAYS);
  const before = snapshots.length;
  snapshots = snapshots.filter((s) => s.weekStart >= cutoff);
  const pruned = before - snapshots.length;
  if (pruned > 0) {
    console.log(`Pruned ${pruned} snapshot(s) older than ${MAX_SNAPSHOT_AGE_DAYS} days`);
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
  pruneOldSnapshots();
  loaded = true;
}

// Take a new daily snapshot if we've crossed into a new day (12:00 AM in TZ).
function maybeRollover(currentRanks, currentNames, currentLetterRanks, currentPBs) {
  if (!loaded) return;
  const today = dayKey();
  const last = snapshots[snapshots.length - 1];
  if (last && last.weekStart >= today) return;
  const snap = {
    weekStart: today,
    ranks: { ...currentRanks },
    names: { ...currentNames },
    letterRanks: { ...currentLetterRanks },
  };
  if (currentPBs) {
    if (currentPBs.sprints) snap.bestSprints = { ...currentPBs.sprints };
    if (currentPBs.blitz) snap.bestBlitz = { ...currentPBs.blitz };
    if (currentPBs.zenith) snap.bestZenith = { ...currentPBs.zenith };
  }
  snapshots.push(snap);
  pruneOldSnapshots();
  persist(); // fire and forget
}

// Find the snapshot closest to (but not after) 7 days ago in Toronto time.
function getBaselineSnapshot() {
  const target = daysAgoKey(7);
  for (let i = snapshots.length - 1; i >= 0; i--) {
    if (snapshots[i].weekStart <= target) return snapshots[i];
  }
  return null;
}

// Ranks from the baseline snapshot (for Change column arrows).
function getBaselineRanks() {
  const snap = getBaselineSnapshot();
  return snap ? snap.ranks : {};
}

// The date (YYYY-MM-DD) the Change column is measured from (7 Toronto days ago).
function getBaselineWeek() {
  if (!hasBaseline()) return null;
  return daysAgoKey(7);
}

// Whether we have a snapshot old enough to compare against.
function hasBaseline() {
  return getBaselineSnapshot() != null;
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

// ----- TETR.IO News API -----

// Fetch a single user's TETR.IO user ID (cached)
async function fetchUserId(username) {
  if (userIdCache[username]) return userIdCache[username];
  try {
    const res = await axios.get(`https://ch.tetr.io/api/users/${username}`, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 10000,
    });
    if (res.data.success && res.data.data?._id) {
      userIdCache[username] = res.data.data._id;
      return res.data.data._id;
    }
  } catch (err) {
    console.warn(`Failed to fetch user ID for ${username}:`, safeErrorMsg(err));
  }
  return null;
}

// Fetch news for a single user from TETR.IO
async function fetchUserNews(username, realName, userId) {
  try {
    const res = await axios.get(`https://ch.tetr.io/api/news/user_${userId}`, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 10000,
    });
    if (!res.data.success) return [];
    const cutoff = new Date(Date.now() - NEWS_TTL_MS).toISOString();
    return (res.data.data.news || [])
      .filter((n) => (n.type === "rankup" || n.type === "personalbest") && n.ts >= cutoff)
      .map((n) => {
        const d = n.data;
        if (n.type === "rankup") {
          return { username, realName, type: "rank", value: d.rank, ts: n.ts };
        }
        const gameMap = { "40l": "sprint", blitz: "blitz", zenith: "zenith", zenithex: "zenithEx" };
        const mapped = gameMap[d.gametype] || d.gametype;
        return { username, realName, type: mapped, value: d.result, ts: n.ts, replayId: d.replayid || null };
      });
  } catch (err) {
    console.warn(`Failed to fetch news for ${username}:`, safeErrorMsg(err));
    return [];
  }
}

// Fetch news for all members — called periodically from server.js
async function fetchAllNews(members) {
  if (newsFetching) return;
  if (Date.now() - lastNewsFetch < NEWS_FETCH_INTERVAL_MS) return;
  newsFetching = true;
  try {
    const allNews = [];
    for (const member of members) {
      const userId = await fetchUserId(member.username);
      if (!userId) continue;
      const news = await fetchUserNews(member.username, member.realName, userId);
      allNews.push(...news);
      // Small delay to avoid hammering TETR.IO API
      await new Promise((r) => setTimeout(r, 200));
    }
    allNews.sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0));
    cachedNews = allNews;
    lastNewsFetch = Date.now();
    console.log(`Fetched ${allNews.length} news items from TETR.IO for ${members.length} members`);
  } catch (err) {
    console.error("Error fetching news:", safeErrorMsg(err));
  } finally {
    newsFetching = false;
  }
}

// Top-of-page highlights derived from movement arrows and real-time achievements.
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

  // Achievements from TETR.IO news API — already sorted newest first
  const achievements = cachedNews.map((a) => ({
    username: a.username, realName: a.realName, type: a.type,
    value: a.value, ts: a.ts, replayId: a.replayId || null,
  }));

  return { climbers, fallers, newPeaks, achievements };
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
  fetchAllNews,
  getMovement,
  getHighlights,
  getBaselineWeek,
  weekStartKey,
};
