import { describe, it, expect } from "vitest";
import {
  fmtDate,
  isUnranked,
  fmtTR,
  fmtStanding,
  normalizeRank,
} from "../leaderboardUtils";

// ---------- fmtDate ----------

describe("fmtDate", () => {
  it("formats a YYYY-MM-DD key into a readable US date", () => {
    expect(fmtDate("2026-06-08")).toBe("Jun 8, 2026");
  });

  it("formats a January date correctly", () => {
    expect(fmtDate("2026-01-15")).toBe("Jan 15, 2026");
  });

  it("formats a December date correctly", () => {
    expect(fmtDate("2025-12-25")).toBe("Dec 25, 2025");
  });

  it("returns empty string for null", () => {
    expect(fmtDate(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(fmtDate(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(fmtDate("")).toBe("");
  });

  it("handles the first day of the year", () => {
    expect(fmtDate("2026-01-01")).toBe("Jan 1, 2026");
  });

  it("handles the last day of the year", () => {
    expect(fmtDate("2026-12-31")).toBe("Dec 31, 2026");
  });
});

// ---------- isUnranked ----------

describe("isUnranked", () => {
  it('returns true for "z" (unranked marker)', () => {
    expect(isUnranked("z")).toBe(true);
  });

  it('returns true for "Z" (case insensitive)', () => {
    expect(isUnranked("Z")).toBe(true);
  });

  it('returns true for "?" (unknown marker)', () => {
    expect(isUnranked("?")).toBe(true);
  });

  it('returns true for "-" (dash)', () => {
    expect(isUnranked("-")).toBe(true);
  });

  it("returns true for empty string", () => {
    expect(isUnranked("")).toBe(true);
  });

  it("returns true for null", () => {
    expect(isUnranked(null)).toBe(true);
  });

  it("returns true for undefined", () => {
    expect(isUnranked(undefined)).toBe(true);
  });

  it('returns false for "s" (S rank)', () => {
    expect(isUnranked("s")).toBe(false);
  });

  it('returns false for "ss" (SS rank)', () => {
    expect(isUnranked("ss")).toBe(false);
  });

  it('returns false for "a+" ', () => {
    expect(isUnranked("a+")).toBe(false);
  });

  it('returns false for "x"', () => {
    expect(isUnranked("x")).toBe(false);
  });

  it('returns false for "b-"', () => {
    expect(isUnranked("b-")).toBe(false);
  });

  it("handles whitespace-padded z", () => {
    expect(isUnranked("  z  ")).toBe(true);
  });
});

// ---------- fmtTR ----------

describe("fmtTR", () => {
  it('returns "Unranked" for a player with z letterRank', () => {
    expect(fmtTR({ letterRank: "z", tr: 15000 })).toBe("Unranked");
  });

  it('returns "Unranked" for a player with null letterRank', () => {
    expect(fmtTR({ letterRank: null, tr: 15000 })).toBe("Unranked");
  });

  it("returns the TR value for a ranked player", () => {
    expect(fmtTR({ letterRank: "ss", tr: 25000.5 })).toBe(25000.5);
  });

  it("returns 0 TR for a ranked player with 0 TR", () => {
    expect(fmtTR({ letterRank: "d", tr: 0 })).toBe(0);
  });

  it('returns "Unranked" for "-" letterRank', () => {
    expect(fmtTR({ letterRank: "-", tr: 5000 })).toBe("Unranked");
  });
});

// ---------- fmtStanding ----------

describe("fmtStanding", () => {
  it("formats a positive standing with locale formatting", () => {
    const result = fmtStanding(1500);
    // Should contain "1,500" or locale equivalent
    expect(result).toContain("1");
    expect(result).toContain("500");
  });

  it("returns en-dash for 0", () => {
    expect(fmtStanding(0)).toBe("\u2013");
  });

  it("returns en-dash for negative values", () => {
    expect(fmtStanding(-1)).toBe("\u2013");
  });

  it("returns en-dash for null", () => {
    expect(fmtStanding(null)).toBe("\u2013");
  });

  it("returns en-dash for undefined", () => {
    expect(fmtStanding(undefined)).toBe("\u2013");
  });

  it("formats standing of 1 as '1'", () => {
    expect(fmtStanding(1)).toBe("1");
  });
});

// ---------- normalizeRank ----------

describe("normalizeRank", () => {
  it("converts rank to lowercase", () => {
    expect(normalizeRank("S")).toBe("s");
  });

  it('replaces "+" with "plus"', () => {
    expect(normalizeRank("s+")).toBe("splus");
  });

  it('replaces "-" with "minus"', () => {
    expect(normalizeRank("b-")).toBe("bminus");
  });

  it("handles SS rank", () => {
    expect(normalizeRank("SS")).toBe("ss");
  });

  it("handles X+ rank", () => {
    expect(normalizeRank("X+")).toBe("xplus");
  });

  it('returns "placeholder" for null', () => {
    expect(normalizeRank(null)).toBe("placeholder");
  });

  it('returns "placeholder" for undefined', () => {
    expect(normalizeRank(undefined)).toBe("placeholder");
  });

  it('returns "placeholder" for empty string', () => {
    expect(normalizeRank("")).toBe("placeholder");
  });

  it("handles A+ rank", () => {
    expect(normalizeRank("A+")).toBe("aplus");
  });

  it("handles C- rank", () => {
    expect(normalizeRank("C-")).toBe("cminus");
  });

  it("handles D rank (no modifier)", () => {
    expect(normalizeRank("D")).toBe("d");
  });
});
