// backend/server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios");
const path = require("path");
const history = require("./history");

const app = express();

// ===== CONFIG =====
const PORT = process.env.PORT || 3001;
const MEMBERS_FILE = path.join(__dirname, "members.json");
const REQUEST_DELAY = parseInt(process.env.REQUEST_DELAY_MS) || 1000;
const USER_AGENT = "Mozilla/5.0";
// ==================

// Enable CORS for any frontend
app.use(cors({ origin: "*" }));

let members = [];
let leaderboardCache = {};
let currentIndex = 0;

// Load members from JSON
function loadMembers() {
  try {
    const raw = fs.readFileSync(MEMBERS_FILE, "utf-8");
    members = JSON.parse(raw);
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
    console.log(`Error updating ${member.username}: ${err.response?.status || err.message}`);
  }
}

// Rotating updater
async function rotatingUpdater() {
  if (members.length === 0) return;
  const member = members[currentIndex];
  await fetchOneUser(member);
  currentIndex = (currentIndex + 1) % members.length;
  setTimeout(rotatingUpdater, REQUEST_DELAY);
}

// API endpoint
app.get("/api/leaderboard", (req, res) => {
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
  list.forEach((m) => {
    currentRanks[m.username] = m.clubRank;
    currentNames[m.username] = m.realName;
  });
  // Only snapshot once the cache is sufficiently warmed, so a new-week
  // rollover isn't taken from a half-populated leaderboard on cold start.
  const warmed = list.length >= Math.max(1, Math.floor(members.length * 0.8));
  if (warmed) history.maybeRollover(currentRanks, currentNames);
  list.forEach((m) => {
    m.move = history.getMovement(m.username, m.clubRank);
  });

  res.json({
    updated: Date.now(),
    totalMembers: members.length,
    cachedMembers: list.length,
    members: list,
    recap: history.getRecap(),
  });
});

// ===== Serve frontend =====
app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

// ===== STARTUP =====
loadMembers();
rotatingUpdater();
history.init();

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));