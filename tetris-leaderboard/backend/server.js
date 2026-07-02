// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const axios = require("axios");
const path = require("path");
const crypto = require("crypto");
const history = require("./history");

const app = express();

// ===== CONFIG =====
const PORT = process.env.PORT || 3001;
const MEMBERS_FILE = path.join(__dirname, "members.json");
const REQUEST_DELAY = Math.max(500, parseInt(process.env.REQUEST_DELAY_MS) || 500);
const USER_AGENT = "TetrisLeaderboard/1.0 (https://github.com/ihmttmhi/Tetris-Leaderboard)";
// ==================

// Trust first proxy (Render, etc.) so rate limiter sees real client IPs
app.set("trust proxy", 1);

// Enable CORS
const ALLOWED_ORIGINS = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map(s => s.trim())
  : ["*"];
app.use(cors({
  origin: ALLOWED_ORIGINS.includes("*") ? "*" : ALLOWED_ORIGINS,
}));

app.use(helmet({
  contentSecurityPolicy: false, // Let Vite/React handle CSP in the HTML
}));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

let members = [];
let leaderboardCache = {};
let currentIndex = 0;
const sseClients = new Set();

// ===== SSE CONNECTION LIMITS =====
// Global cap is the primary DoS defense: it bounds total open connections so
// the server can't exhaust file descriptors / memory regardless of source.
// Per-browser single-tab enforcement is handled client-side via the Web Locks
// API (see frontend). No per-IP cap: on shared networks (school WiFi / NAT)
// all legitimate users share one public IP, so a per-IP cap would wrongly
// block them.
const SSE_MAX_CONNECTIONS = parseInt(process.env.SSE_MAX_CONNECTIONS) || 250;
const SSE_TIMEOUT_MS = parseInt(process.env.SSE_TIMEOUT_MS) || 30 * 60 * 1000; // 30 min

// ===== ADMIN PANEL =====
// Password lives ONLY in the ADMIN_PASSWORD env var (set on Render), never in
// the repo. If it's unset, the admin panel is disabled entirely.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const adminSessions = new Map(); // sessionToken -> expiresAt (ms)
const sseConnectionMeta = new Map(); // res -> { ip, userAgent, connectedAt }
const SERVER_START_TIME = Date.now();

// Load members from JSON
function loadMembers() {
  try {
    const raw = fs.readFileSync(MEMBERS_FILE, "utf-8");
    members = JSON.parse(raw);
    members = members.filter(m => {
      if (!/^[a-zA-Z0-9_-]+$/.test(m.username)) {
        console.warn(`Skipping member with invalid username: ${m.username}`);
        return false;
      }
      return true;
    });
    console.log(`Loaded ${members.length} members`);
  } catch (err) {
    console.error("Failed to load members.json:", err.message);
    members = [];
  }
}

// Fetch one member (all summaries in a single call)
async function fetchOneUser(member) {
  try {
    const url = `https://ch.tetr.io/api/users/${member.username}/summaries`;
    const response = await axios.get(url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 10000,
    });

    if (!response.data.success || !response.data.data) {
      leaderboardCache[member.username] = {
        realName: member.realName,
        username: member.username,
        tr: 0,
        pps: 0,
        apm: 0,
        vs: 0,
        rank: "-",
        standing_world: 0,
        standing_local: 0,
        sprint: null,
        blitz: null,
        zenith: null,
        zenithEx: null,
        updated: Date.now(),
      };
      console.warn(`User not found or private: ${member.username}`);
      return;
    }

    const d = response.data.data;
    const league = d.league || {};
    const sprintRec = d["40l"]?.record;
    const blitzRec = d.blitz?.record;
    const zenithRec = d.zenith?.record;
    const zenithExRec = d.zenithex?.record;
    const zenithBestRec = d.zenith?.best?.record;
    const zenithExBestRec = d.zenithex?.best?.record;

    // Extract detailed stats for 40L
    const sprintStats = sprintRec?.results?.stats;
    const sprintAgg = sprintRec?.results?.aggregatestats;

    // Extract detailed stats for Blitz
    const blitzStats = blitzRec?.results?.stats;
    const blitzAgg = blitzRec?.results?.aggregatestats;

    // Extract detailed stats for Zenith (current season)
    const zenithStats = zenithRec?.results?.stats;
    const zenithAgg = zenithRec?.results?.aggregatestats;

    // Extract detailed stats for Zenith Expert (current season)
    const zenithExStats = zenithExRec?.results?.stats;
    const zenithExAgg = zenithExRec?.results?.aggregatestats;

    const sprintInputs = sprintStats?.inputs ?? 0;
    const sprintPieces = sprintStats?.piecesplaced ?? 0;
    const sprintPerfect = sprintStats?.finesse?.perfectpieces ?? 0;
    const sprintTime = sprintStats?.finaltime ?? 0;

    const blitzInputs = blitzStats?.inputs ?? 0;
    const blitzPieces = blitzStats?.piecesplaced ?? 0;
    const blitzScore = blitzStats?.score ?? 0;
    const blitzPerfect = blitzStats?.finesse?.perfectpieces ?? 0;

    leaderboardCache[member.username] = {
      realName: member.realName,
      username: member.username,
      grade: member.grade,
      letterRank: league.rank || "-",
      tr: league.tr || 0,
      pps: league.pps || 0,
      apm: league.apm || 0,
      vs: league.vs || 0,
      standing_world: league.standing || 0,
      standing_local: league.standing_local || 0,
      gamesPlayed: league.gamesplayed || 0,
      gamesWon: league.gameswon || 0,
      glicko: league.glicko || null,
      rd: league.rd || null,
      // 40L (matches TETR.IO: Finesse, KPP, KPS, Pieces, PPS, Time)
      sprintReplayId: sprintRec?.replayid || null,
      sprint: sprintStats ? sprintStats.finaltime : null,
      sprintPPS: sprintAgg?.pps ?? null,
      sprintPieces: sprintPieces || null,
      sprintFinesseFaults: sprintStats?.finesse?.faults ?? null,
      sprintFinessePct: sprintPieces > 0 ? (sprintPerfect / sprintPieces) * 100 : null,
      sprintKPP: sprintPieces > 0 ? sprintInputs / sprintPieces : null,
      sprintKPS: sprintTime > 0 ? sprintInputs / (sprintTime / 1000) : null,
      // Blitz (matches TETR.IO: Finesse, SPP, Level, Pieces, PPS, Score)
      blitzReplayId: blitzRec?.replayid || null,
      blitz: blitzStats ? blitzStats.score : null,
      blitzPPS: blitzAgg?.pps ?? null,
      blitzPieces: blitzPieces || null,
      blitzLevel: blitzStats?.level ?? null,
      blitzFinesseFaults: blitzStats?.finesse?.faults ?? null,
      blitzFinessePct: blitzPieces > 0 ? (blitzPerfect / blitzPieces) * 100 : null,
      blitzSPP: blitzPieces > 0 ? blitzScore / blitzPieces : null,
      // Zenith QP (matches TETR.IO: Time, KOs, Climb speed, APM, PPS, Altitude)
      zenithReplayId: zenithRec?.replayid || null,
      zenith: zenithStats ? zenithStats.zenith.altitude : null,
      zenithPPS: zenithAgg?.pps ?? null,
      zenithAPM: zenithAgg?.apm ?? null,
      zenithKOs: zenithStats?.kills ?? null,
      zenithTime: zenithStats?.finaltime ?? null,
      zenithClimbAvg: zenithStats?.zenith?.rank ?? null,
      zenithClimbPeak: zenithStats?.zenith?.peakrank ?? null,
      // Zenith all-time best
      zenithBestReplayId: zenithBestRec?.replayid || null,
      zenithBest: zenithBestRec ? zenithBestRec.results.stats.zenith.altitude : null,
      // Zenith Expert (matches TETR.IO: Time, KOs, Climb speed, APM, PPS, Altitude)
      zenithExReplayId: zenithExRec?.replayid || null,
      zenithEx: zenithExStats ? zenithExStats.zenith.altitude : null,
      zenithExPPS: zenithExAgg?.pps ?? null,
      zenithExAPM: zenithExAgg?.apm ?? null,
      zenithExKOs: zenithExStats?.kills ?? null,
      zenithExTime: zenithExStats?.finaltime ?? null,
      zenithExClimbAvg: zenithExStats?.zenith?.rank ?? null,
      zenithExClimbPeak: zenithExStats?.zenith?.peakrank ?? null,
      // Zenith Expert all-time best
      zenithExBestReplayId: zenithExBestRec?.replayid || null,
      zenithExBest: zenithExBestRec ? zenithExBestRec.results.stats.zenith.altitude : null,
      updated: Date.now(),
    };

    console.log(`Updated ${member.username}`);
    notifyClients();
  } catch (err) {
    console.error(`Error updating ${member.username}: ${err.response?.status || err.message}`);
  }
}

// Rotating updater
async function rotatingUpdater() {
  if (members.length === 0) return;
  try {
    const member = members[currentIndex];
    await fetchOneUser(member);
    currentIndex = (currentIndex + 1) % members.length;
  } catch (err) {
    console.error("Unexpected error in rotatingUpdater:", err.message);
  }
  // Periodically refresh news from TETR.IO (rate-limited inside fetchAllNews)
  history.fetchAllNews(members).catch((err) =>
    console.error("News fetch error:", err.message)
  );
  setTimeout(rotatingUpdater, REQUEST_DELAY);
}

// Build the current leaderboard payload (shared by REST + SSE)
function buildLeaderboard() {
  const list = Object.values(leaderboardCache);
  list.sort((a, b) => b.tr - a.tr);
  list.forEach((member, index) => {
    member.clubRank = index + 1;
  });

  const currentRanks = {};
  const currentNames = {};
  const currentLetterRanks = {};
  const currentPBs = { sprints: {}, blitz: {}, zenith: {} };
  list.forEach((m) => {
    currentRanks[m.username] = m.clubRank;
    currentNames[m.username] = m.realName;
    if (m.letterRank) currentLetterRanks[m.username] = m.letterRank;
    if (m.sprint != null) currentPBs.sprints[m.username] = m.sprint;
    if (m.blitz != null) currentPBs.blitz[m.username] = m.blitz;
    if (m.zenith != null) currentPBs.zenith[m.username] = m.zenith;
  });
  const warmed = list.length >= Math.max(1, Math.floor(members.length * 0.8));
  if (warmed) history.maybeRollover(currentRanks, currentNames, currentLetterRanks, currentPBs);
  list.forEach((m) => {
    m.move = history.getMovement(m.username, m.clubRank);
  });

  return {
    updated: Date.now(),
    totalMembers: members.length,
    cachedMembers: list.length,
    members: list,
    recap: null,
    highlights: history.getHighlights(list),
    since: history.getBaselineWeek(),
  };
}

// Notify all SSE clients after a player is updated
function notifyClients() {
  if (sseClients.size === 0) return;
  try {
    const payload = JSON.stringify(buildLeaderboard());
    for (const res of sseClients) {
      res.write(`data: ${payload}\n\n`);
    }
  } catch (err) {
    console.error("Error notifying SSE clients:", err.message);
  }
}

// SSE endpoint — pushes leaderboard after each player fetch
app.get("/api/leaderboard/stream", (req, res) => {
  const sendSSEError = (reason) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(`event: connection_error\ndata: ${JSON.stringify({ error: reason })}\n\n`);
    res.end();
  };

  if (sseClients.size >= SSE_MAX_CONNECTIONS) {
    return sendSSEError("Server is at capacity. Please try again later.");
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send current state immediately
  try {
    res.write(`data: ${JSON.stringify(buildLeaderboard())}\n\n`);
  } catch (err) {
    console.error("Error sending initial SSE payload:", err.message);
  }

  sseClients.add(res);
  sseConnectionMeta.set(res, {
    ip: (req.ip || "unknown").replace(/^::ffff:/, ""),
    userAgent: req.get("user-agent") || "unknown",
    connectedAt: Date.now(),
  });

  const timeout = setTimeout(() => {
    res.end();
  }, SSE_TIMEOUT_MS);

  req.on("close", () => {
    clearTimeout(timeout);
    sseClients.delete(res);
    sseConnectionMeta.delete(res);
  });
});

// API endpoint
app.get("/api/leaderboard", (req, res) => {
  try {
    res.json(buildLeaderboard());
  } catch (err) {
    console.error("Error building leaderboard response:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== ADMIN PANEL ROUTES =====
function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key) out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

// Constant-time password check: hash both sides to a fixed length first so we
// never leak the password length or short-circuit on the first wrong character.
function passwordMatches(provided) {
  const a = crypto.createHash("sha256").update(String(provided)).digest();
  const b = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function pruneAdminSessions() {
  const now = Date.now();
  for (const [token, exp] of adminSessions) {
    if (exp < now) adminSessions.delete(token);
  }
}

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: "Admin panel is not configured." });
  }
  const token = parseCookies(req).admin_session;
  const exp = token ? adminSessions.get(token) : null;
  if (!exp || exp < Date.now()) {
    if (token) adminSessions.delete(token);
    return res.status(401).json({ error: "Not authenticated." });
  }
  next();
}

// Stricter limiter on login to slow brute-force guessing.
const adminLoginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please wait a minute." },
});

app.post("/api/admin/login", adminLoginLimiter, express.json(), (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({
      error: "Admin panel is not configured. Set the ADMIN_PASSWORD environment variable.",
    });
  }
  const password = (req.body && req.body.password) || "";
  if (!password || !passwordMatches(password)) {
    return res.status(401).json({ error: "Incorrect password." });
  }
  pruneAdminSessions();
  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, Date.now() + ADMIN_SESSION_TTL_MS);
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.setHeader(
    "Set-Cookie",
    `admin_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(
      ADMIN_SESSION_TTL_MS / 1000
    )}${isHttps ? "; Secure" : ""}`
  );
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  const token = parseCookies(req).admin_session;
  if (token) adminSessions.delete(token);
  res.setHeader(
    "Set-Cookie",
    "admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
  );
  res.json({ ok: true });
});

app.get("/api/admin/stats", requireAdmin, (req, res) => {
  const now = Date.now();
  const connections = [];
  const byIP = new Map();
  for (const meta of sseConnectionMeta.values()) {
    connections.push({
      ip: meta.ip,
      userAgent: meta.userAgent,
      connectedAt: meta.connectedAt,
      durationMs: now - meta.connectedAt,
    });
    byIP.set(meta.ip, (byIP.get(meta.ip) || 0) + 1);
  }
  connections.sort((a, b) => a.connectedAt - b.connectedAt);
  const ipList = [...byIP.entries()]
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count);
  res.json({
    serverTime: now,
    uptimeMs: now - SERVER_START_TIME,
    totalConnections: connections.length,
    maxConnections: SSE_MAX_CONNECTIONS,
    uniqueIPs: byIP.size,
    byIP: ipList,
    connections,
    totalMembers: members.length,
    cachedMembers: Object.keys(leaderboardCache).length,
  });
});

app.get("/admin", (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(__dirname, "admin.html"), (err) => {
    if (err && !res.headersSent) {
      res.status(500).end();
    }
  });
});

// ===== Serve frontend =====
// Hashed JS/CSS assets are content-addressed, so cache them forever. index.html
// must always be revalidated, otherwise a browser keeps serving the old page
// (pointing at a stale bundle) after a Render redeploy until a manual refresh.
const DIST_DIR = path.join(__dirname, "../frontend/dist");
app.use(
  express.static(DIST_DIR, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      } else {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  })
);

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(DIST_DIR, "index.html"), (err) => {
    if (err) {
      console.error("Failed to serve index.html:", err.message);
      if (!res.headersSent) {
        res.status(err.status || 500).end();
      }
    }
  });
});

// ===== STARTUP =====
async function start() {
  loadMembers();
  await history.init();
  rotatingUpdater();

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
    .on("error", (err) => {
      console.error("Failed to start server:", err.message);
      process.exit(1);
    });
}

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});