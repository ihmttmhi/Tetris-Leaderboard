jest.mock("fs");
jest.mock("axios");

process.env.GITHUB_TOKEN = "";

let history;
let fs;

function freshHistory(snapshotsJson) {
  jest.resetModules();
  fs = require("fs");
  fs.readFileSync.mockReturnValue(snapshotsJson || "[]");
  fs.writeFileSync.mockImplementation(() => {});
  history = require("../history");
}

beforeEach(() => {
  freshHistory("[]");
});

// ---------- weekStartKey ----------

describe("weekStartKey", () => {
  it("returns the most recent Sunday for a mid-week date", () => {
    // 2026-06-18 is a Thursday; the preceding Sunday is 2026-06-14
    const thursday = new Date("2026-06-18T12:00:00Z");
    expect(history.weekStartKey(thursday)).toBe("2026-06-14");
  });

  it("returns the same date when the date is already a Sunday", () => {
    const sunday = new Date("2026-06-14T05:00:00Z");
    expect(history.weekStartKey(sunday)).toBe("2026-06-14");
  });

  it("returns the preceding Sunday for a Saturday", () => {
    const saturday = new Date("2026-06-20T23:00:00Z");
    expect(history.weekStartKey(saturday)).toBe("2026-06-14");
  });

  it("returns the preceding Sunday for a Monday", () => {
    const monday = new Date("2026-06-15T10:00:00Z");
    expect(history.weekStartKey(monday)).toBe("2026-06-14");
  });

  it("handles year boundaries", () => {
    // 2026-01-01 is a Thursday; preceding Sunday is 2025-12-28
    const newYear = new Date("2026-01-01T12:00:00Z");
    expect(history.weekStartKey(newYear)).toBe("2025-12-28");
  });
});

// ---------- init (local fallback) ----------

describe("init", () => {
  it("loads snapshots from local file when no GITHUB_TOKEN", async () => {
    const snapshots = [
      { weekStart: "2026-06-07", ranks: { alice: 1 }, names: { alice: "Alice" } },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();
    // With only 1 snapshot, hasBaseline is false, so getBaselineWeek returns null
    expect(history.getBaselineWeek()).toBeNull();
  });

  it("starts with empty snapshots when local file is missing", async () => {
    freshHistory("[]");
    fs.readFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    await history.init();
    expect(history.getBaselineWeek()).toBeNull();
  });
});

// ---------- getMovement ----------

describe("getMovement", () => {
  it("returns 'new' when there is no baseline (< 2 snapshots)", async () => {
    freshHistory("[]");
    await history.init();
    const result = history.getMovement("alice", 1);
    expect(result).toEqual({ dir: "new", delta: 0 });
  });

  it("returns 'new' for a player not in the baseline", async () => {
    const snapshots = [
      { weekStart: "2026-06-01", ranks: { alice: 1 }, names: { alice: "Alice" } },
      { weekStart: "2026-06-08", ranks: { alice: 2 }, names: { alice: "Alice" } },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();
    const result = history.getMovement("bob", 3);
    expect(result).toEqual({ dir: "new", delta: 0 });
  });

  it("returns 'up' when player moved to a lower rank number", async () => {
    const snapshots = [
      { weekStart: "2026-06-01", ranks: { alice: 1 }, names: {} },
      { weekStart: "2026-06-08", ranks: { alice: 5 }, names: {} },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();
    // baseline rank is 5 (from last snapshot), current rank is 2
    // delta = 5 - 2 = 3 (positive = up)
    const result = history.getMovement("alice", 2);
    expect(result).toEqual({ dir: "up", delta: 3 });
  });

  it("returns 'down' when player moved to a higher rank number", async () => {
    const snapshots = [
      { weekStart: "2026-06-01", ranks: { alice: 1 }, names: {} },
      { weekStart: "2026-06-08", ranks: { alice: 2 }, names: {} },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();
    // baseline rank is 2 (last snapshot), current rank is 5
    // delta = 2 - 5 = -3 (negative = down)
    const result = history.getMovement("alice", 5);
    expect(result).toEqual({ dir: "down", delta: 3 });
  });

  it("returns 'same' when rank is unchanged", async () => {
    const snapshots = [
      { weekStart: "2026-06-01", ranks: { alice: 3 }, names: {} },
      { weekStart: "2026-06-08", ranks: { alice: 3 }, names: {} },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();
    const result = history.getMovement("alice", 3);
    expect(result).toEqual({ dir: "same", delta: 0 });
  });
});

// ---------- maybeRollover ----------

describe("maybeRollover", () => {
  it("creates a new snapshot when entering a new week", async () => {
    freshHistory("[]");
    await history.init();

    const ranks = { alice: 1, bob: 2 };
    const names = { alice: "Alice", bob: "Bob" };
    history.maybeRollover(ranks, names);

    // One snapshot now; still no baseline (need >= 2)
    expect(history.getBaselineWeek()).toBeNull();

    // Calling again in the same week should not create a duplicate
    history.maybeRollover(ranks, names);
    expect(history.getBaselineWeek()).toBeNull();
  });

  it("does not create a snapshot before init is called", () => {
    freshHistory("[]");
    // Do NOT call init — loaded is false
    history.maybeRollover({ alice: 1 }, { alice: "Alice" });
    expect(history.getBaselineWeek()).toBeNull();
  });

  it("persists to local file when creating a snapshot", async () => {
    freshHistory("[]");
    await history.init();

    history.maybeRollover({ alice: 1 }, { alice: "Alice" });

    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});

// ---------- getRecap ----------

describe("getRecap", () => {
  it("returns null when fewer than 2 snapshots exist", async () => {
    freshHistory(
      JSON.stringify([{ weekStart: "2026-06-08", ranks: { a: 1 }, names: { a: "A" } }])
    );
    await history.init();
    expect(history.getRecap()).toBeNull();
  });

  it("returns movers comparing the two latest snapshots", async () => {
    const snapshots = [
      { weekStart: "2026-06-01", ranks: { alice: 3, bob: 1 }, names: { alice: "Alice", bob: "Bob" } },
      { weekStart: "2026-06-08", ranks: { alice: 1, bob: 3 }, names: { alice: "Alice", bob: "Bob" } },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();

    const recap = history.getRecap();
    expect(recap).not.toBeNull();
    expect(recap.weekFrom).toBe("2026-06-01");
    expect(recap.weekTo).toBe("2026-06-08");
    expect(recap.movers).toHaveLength(2);

    const alice = recap.movers.find((m) => m.username === "alice");
    expect(alice.dir).toBe("up");
    expect(alice.delta).toBe(2);

    const bob = recap.movers.find((m) => m.username === "bob");
    expect(bob.dir).toBe("down");
    expect(bob.delta).toBe(2);
  });

  it("sorts movers by absolute delta descending", async () => {
    const snapshots = [
      {
        weekStart: "2026-06-01",
        ranks: { alice: 5, bob: 2, carol: 1 },
        names: { alice: "Alice", bob: "Bob", carol: "Carol" },
      },
      {
        weekStart: "2026-06-08",
        ranks: { alice: 1, bob: 3, carol: 2 },
        names: { alice: "Alice", bob: "Bob", carol: "Carol" },
      },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();

    const recap = history.getRecap();
    expect(recap.movers[0].username).toBe("alice");
    expect(recap.movers[0].delta).toBe(4);
  });

  it("skips players who only appear in the current snapshot", async () => {
    const snapshots = [
      { weekStart: "2026-06-01", ranks: { alice: 1 }, names: { alice: "Alice" } },
      { weekStart: "2026-06-08", ranks: { alice: 1, bob: 2 }, names: { alice: "Alice", bob: "Bob" } },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();

    const recap = history.getRecap();
    const bob = recap.movers.find((m) => m.username === "bob");
    expect(bob).toBeUndefined();
  });

  it("marks movers with same rank as 'same'", async () => {
    const snapshots = [
      { weekStart: "2026-06-01", ranks: { alice: 1 }, names: { alice: "Alice" } },
      { weekStart: "2026-06-08", ranks: { alice: 1 }, names: { alice: "Alice" } },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();

    const recap = history.getRecap();
    const alice = recap.movers.find((m) => m.username === "alice");
    expect(alice.dir).toBe("same");
    expect(alice.delta).toBe(0);
  });
});

// ---------- getHighlights ----------

describe("getHighlights", () => {
  it("returns empty arrays when there are no movers", async () => {
    freshHistory("[]");
    await history.init();

    const list = [
      { username: "alice", realName: "Alice", clubRank: 1, move: { dir: "new", delta: 0 } },
    ];
    const highlights = history.getHighlights(list);
    expect(highlights.climbers).toEqual([]);
    expect(highlights.fallers).toEqual([]);
    expect(highlights.newPeaks).toEqual([]);
  });

  it("identifies top climbers and fallers", async () => {
    const snapshots = [
      { weekStart: "2026-06-01", ranks: { alice: 5, bob: 1 }, names: {} },
      { weekStart: "2026-06-08", ranks: { alice: 5, bob: 1 }, names: {} },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();

    const list = [
      { username: "alice", realName: "Alice", clubRank: 1, move: { dir: "up", delta: 4 } },
      { username: "bob", realName: "Bob", clubRank: 5, move: { dir: "down", delta: 4 } },
    ];
    const highlights = history.getHighlights(list);
    expect(highlights.climbers).toHaveLength(1);
    expect(highlights.climbers[0].username).toBe("alice");
    expect(highlights.fallers).toHaveLength(1);
    expect(highlights.fallers[0].username).toBe("bob");
  });

  it("limits climbers and fallers to 3 each", async () => {
    const snapshots = [
      { weekStart: "2026-06-01", ranks: {}, names: {} },
      { weekStart: "2026-06-08", ranks: {}, names: {} },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();

    const list = Array.from({ length: 5 }, (_, i) => ({
      username: `user${i}`,
      realName: `User ${i}`,
      clubRank: i + 1,
      move: { dir: "up", delta: 5 - i },
    }));
    const highlights = history.getHighlights(list);
    expect(highlights.climbers).toHaveLength(3);
  });

  it("detects new personal-best ranks", async () => {
    const snapshots = [
      { weekStart: "2026-06-01", ranks: { alice: 5 }, names: { alice: "Alice" } },
      { weekStart: "2026-06-08", ranks: { alice: 3 }, names: { alice: "Alice" } },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();

    // Alice's best historical rank is 3 (from snapshot 2), current clubRank is 2 (better)
    const list = [
      { username: "alice", realName: "Alice", clubRank: 2, move: { dir: "up", delta: 1 } },
    ];
    const highlights = history.getHighlights(list);
    expect(highlights.newPeaks).toHaveLength(1);
    expect(highlights.newPeaks[0].rank).toBe(2);
  });

  it("does not report personal-best when rank is not better than historical", async () => {
    const snapshots = [
      { weekStart: "2026-06-01", ranks: { alice: 1 }, names: { alice: "Alice" } },
      { weekStart: "2026-06-08", ranks: { alice: 2 }, names: { alice: "Alice" } },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();

    const list = [
      { username: "alice", realName: "Alice", clubRank: 2, move: { dir: "down", delta: 1 } },
    ];
    const highlights = history.getHighlights(list);
    expect(highlights.newPeaks).toHaveLength(0);
  });

  it("sorts new peaks by clubRank ascending", async () => {
    const snapshots = [
      { weekStart: "2026-06-01", ranks: { alice: 5, bob: 8 }, names: {} },
      { weekStart: "2026-06-08", ranks: { alice: 4, bob: 7 }, names: {} },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();

    const list = [
      { username: "bob", realName: "Bob", clubRank: 3, move: { dir: "up", delta: 4 } },
      { username: "alice", realName: "Alice", clubRank: 1, move: { dir: "up", delta: 3 } },
    ];
    const highlights = history.getHighlights(list);
    expect(highlights.newPeaks[0].username).toBe("alice");
    expect(highlights.newPeaks[1].username).toBe("bob");
  });
});

// ---------- getBaselineWeek ----------

describe("getBaselineWeek", () => {
  it("returns null with no snapshots", async () => {
    freshHistory("[]");
    await history.init();
    expect(history.getBaselineWeek()).toBeNull();
  });

  it("returns null with only 1 snapshot (no real baseline)", async () => {
    const snapshots = [
      { weekStart: "2026-06-08", ranks: { alice: 1 }, names: { alice: "Alice" } },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();
    expect(history.getBaselineWeek()).toBeNull();
  });

  it("returns the last snapshot's weekStart with >= 2 snapshots", async () => {
    const snapshots = [
      { weekStart: "2026-06-01", ranks: { alice: 1 }, names: {} },
      { weekStart: "2026-06-08", ranks: { alice: 2 }, names: {} },
    ];
    freshHistory(JSON.stringify(snapshots));
    await history.init();
    expect(history.getBaselineWeek()).toBe("2026-06-08");
  });
});

// ---------- MAX_SNAPSHOTS trimming ----------

describe("snapshot trimming", () => {
  it("trims snapshots to MAX_SNAPSHOTS (8) on rollover", async () => {
    const snapshots = Array.from({ length: 8 }, (_, i) => ({
      weekStart: `2025-0${Math.floor(i / 5) + 1}-0${(i % 5) * 7 + 1}`,
      ranks: { alice: i + 1 },
      names: { alice: "Alice" },
    }));
    freshHistory(JSON.stringify(snapshots));
    await history.init();

    // Force a rollover (current week will be > all snapshot dates)
    history.maybeRollover({ alice: 1 }, { alice: "Alice" });

    // getRecap should work (>= 2 snapshots exist)
    const recap = history.getRecap();
    expect(recap).not.toBeNull();
  });
});
