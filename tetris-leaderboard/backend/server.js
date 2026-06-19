// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const axios = require("axios");
const path = require("path");
const history = require("./history");

const app = express();

// ===== CONFIG =====
const PORT = process.env.PORT || 3001;
const MEMBERS_FILE = path.join(__dirname, "members.json");
const REQUEST_DELAY = Math.max(500, parseInt(process.env.REQUEST_DELAY_MS) || 500);
const USER_AGENT = "TetrisLeaderboard/1.0 (https://github.com/athletictrack/Tetris-Leaderboard)";
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

// Fetch one member
async function fetchOneUser(member) {
  try {
    const url = `https://ch.tetr.io/api/users/${member.username}/summaries/league`;
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
        updated: Date.now(),
      };
      console.warn(`User not found or private: ${member.username}`);
      return;
    }

    const data = response.data.data;

    leaderboardCache[member.username] = {
      realName: member.realName,
      username: member.username,
      grade: member.grade,
      letterRank: data.rank || "-",   // letter rank from API (S, S+, etc.)
      tr: data.tr || 0,               // rating used for ordering club leaderboard
      pps: data.pps || 0,
      apm: data.apm || 0,
      vs: data.vs || 0,
      standing_world: data.standing || 0,      // global numeric rank
      standing_local: data.standing_local || 0,// country numeric rank
      updated: Date.now(),
    };

    console.log(`Updated ${member.username}`);
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
  setTimeout(rotatingUpdater, REQUEST_DELAY);
}

// API endpoint
app.get("/api/leaderboard", (req, res) => {
  try {
    const list = Object.values(leaderboardCache);
    // Sort by TR descending
    list.sort((a, b) => b.tr - a.tr);
    // Assign clubRank
    list.forEach((member, index) => {
      member.clubRank = index + 1;
    });

    // Weekly history: roll over a snapshot if we've entered a new week, then
    // attach each player's movement vs the start-of-week baseline.
    const currentRanks = {};
    const currentNames = {};
    const currentLetterRanks = {};
    list.forEach((m) => {
      currentRanks[m.username] = m.clubRank;
      currentNames[m.username] = m.realName;
      if (m.letterRank) currentLetterRanks[m.username] = m.letterRank;
    });
    // Only snapshot once the cache is sufficiently warmed, so a new-week
    // rollover isn't taken from a half-populated leaderboard on cold start.
    const warmed = list.length >= Math.max(1, Math.floor(members.length * 0.8));
    if (warmed) history.maybeRollover(currentRanks, currentNames, currentLetterRanks);
    list.forEach((m) => {
      m.move = history.getMovement(m.username, m.clubRank);
    });

    res.json({
      updated: Date.now(),
      totalMembers: members.length,
      cachedMembers: list.length,
      members: list,
      recap: history.getRecap(),
      highlights: history.getHighlights(list),
      since: history.getBaselineWeek(),
    });
  } catch (err) {
    console.error("Error building leaderboard response:", err);
    res.status(500).json({ error: "Internal server error" });
  }
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