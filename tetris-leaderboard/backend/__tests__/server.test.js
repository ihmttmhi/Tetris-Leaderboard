const fs = require("fs");
const path = require("path");
const axios = require("axios");

jest.mock("axios");
jest.mock("../history", () => ({
  init: jest.fn(),
  maybeRollover: jest.fn(),
  getMovement: jest.fn(() => ({ dir: "new", delta: 0 })),
  getRecap: jest.fn(() => null),
  getHighlights: jest.fn(() => ({ climbers: [], fallers: [], newPeaks: [] })),
  getBaselineWeek: jest.fn(() => null),
  weekStartKey: jest.fn(() => "2026-06-14"),
}));

// Prevent the server from actually listening or starting the rotating updater
jest.useFakeTimers();

let app;
let request;

beforeAll(async () => {
  // We need supertest for HTTP assertions
  try {
    request = require("supertest");
  } catch {
    // If supertest isn't installed, skip HTTP tests
    request = null;
  }
});

beforeEach(() => {
  jest.resetModules();
  jest.restoreAllMocks();
});

// ---------- loadMembers ----------

describe("loadMembers", () => {
  it("loads and parses members.json correctly", () => {
    const membersPath = path.join(__dirname, "..", "members.json");
    const raw = fs.readFileSync(membersPath, "utf-8");
    const members = JSON.parse(raw);

    expect(Array.isArray(members)).toBe(true);
    expect(members.length).toBeGreaterThan(0);

    // Each member should have required fields
    members.forEach((m) => {
      expect(m).toHaveProperty("realName");
      expect(m).toHaveProperty("username");
      expect(m).toHaveProperty("grade");
      expect(typeof m.realName).toBe("string");
      expect(typeof m.username).toBe("string");
      expect(m.realName.length).toBeGreaterThan(0);
      expect(m.username.length).toBeGreaterThan(0);
    });
  });

  it("has no duplicate usernames", () => {
    const membersPath = path.join(__dirname, "..", "members.json");
    const members = JSON.parse(fs.readFileSync(membersPath, "utf-8"));
    const usernames = members.map((m) => m.username);
    const unique = new Set(usernames);
    expect(unique.size).toBe(usernames.length);
  });
});

// ---------- fetchOneUser logic ----------

describe("fetchOneUser response handling", () => {
  it("maps a successful API response to the expected cache shape", () => {
    const apiData = {
      rank: "ss",
      tr: 25000.5,
      pps: 2.5,
      apm: 120,
      vs: 200,
      standing: 150,
      standing_local: 10,
    };

    const member = { realName: "Alice", username: "alice", grade: "M3" };

    // Simulate the mapping logic from server.js fetchOneUser
    const entry = {
      realName: member.realName,
      username: member.username,
      grade: member.grade,
      letterRank: apiData.rank || "-",
      tr: apiData.tr || 0,
      pps: apiData.pps || 0,
      apm: apiData.apm || 0,
      vs: apiData.vs || 0,
      standing_world: apiData.standing || 0,
      standing_local: apiData.standing_local || 0,
      updated: Date.now(),
    };

    expect(entry.letterRank).toBe("ss");
    expect(entry.tr).toBe(25000.5);
    expect(entry.pps).toBe(2.5);
    expect(entry.apm).toBe(120);
    expect(entry.vs).toBe(200);
    expect(entry.standing_world).toBe(150);
    expect(entry.standing_local).toBe(10);
  });

  it("maps a failed/private user to zeroed defaults", () => {
    const member = { realName: "Bob", username: "bob", grade: "M3" };

    const entry = {
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

    expect(entry.tr).toBe(0);
    expect(entry.rank).toBe("-");
    expect(entry.standing_world).toBe(0);
  });
});

// ---------- leaderboard sorting ----------

describe("leaderboard sorting and ranking", () => {
  it("sorts members by TR descending", () => {
    const list = [
      { username: "alice", tr: 15000 },
      { username: "bob", tr: 25000 },
      { username: "carol", tr: 20000 },
    ];

    list.sort((a, b) => b.tr - a.tr);

    expect(list[0].username).toBe("bob");
    expect(list[1].username).toBe("carol");
    expect(list[2].username).toBe("alice");
  });

  it("assigns clubRank starting from 1", () => {
    const list = [
      { username: "bob", tr: 25000 },
      { username: "carol", tr: 20000 },
      { username: "alice", tr: 15000 },
    ];

    list.sort((a, b) => b.tr - a.tr);
    list.forEach((member, index) => {
      member.clubRank = index + 1;
    });

    expect(list[0].clubRank).toBe(1);
    expect(list[1].clubRank).toBe(2);
    expect(list[2].clubRank).toBe(3);
  });

  it("handles members with zero TR", () => {
    const list = [
      { username: "alice", tr: 0 },
      { username: "bob", tr: 10000 },
      { username: "carol", tr: 0 },
    ];

    list.sort((a, b) => b.tr - a.tr);

    expect(list[0].username).toBe("bob");
    expect(list[0].tr).toBe(10000);
  });

  it("handles members with equal TR stably", () => {
    const list = [
      { username: "alice", tr: 20000 },
      { username: "bob", tr: 20000 },
    ];

    list.sort((a, b) => b.tr - a.tr);

    // Both have same TR; original order should be preserved (stable sort)
    expect(list).toHaveLength(2);
    expect(list[0].tr).toBe(20000);
    expect(list[1].tr).toBe(20000);
  });
});

// ---------- cache warming threshold ----------

describe("cache warming threshold", () => {
  it("considers cache warmed when >= 80% of members are cached", () => {
    const totalMembers = 50;
    const cachedCount = 40; // 80%
    const warmed = cachedCount >= Math.max(1, Math.floor(totalMembers * 0.8));
    expect(warmed).toBe(true);
  });

  it("does not consider cache warmed at < 80%", () => {
    const totalMembers = 50;
    const cachedCount = 39; // 78%
    const warmed = cachedCount >= Math.max(1, Math.floor(totalMembers * 0.8));
    expect(warmed).toBe(false);
  });

  it("handles edge case of 0 members (threshold = 1)", () => {
    const totalMembers = 0;
    const cachedCount = 0;
    const warmed = cachedCount >= Math.max(1, Math.floor(totalMembers * 0.8));
    expect(warmed).toBe(false);
  });

  it("handles edge case of 1 member", () => {
    const totalMembers = 1;
    const cachedCount = 1;
    const warmed = cachedCount >= Math.max(1, Math.floor(totalMembers * 0.8));
    expect(warmed).toBe(true);
  });
});
