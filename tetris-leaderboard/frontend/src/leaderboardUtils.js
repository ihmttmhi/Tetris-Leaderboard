// Pure utility functions extracted from App.jsx for testability.

// Format a YYYY-MM-DD week key into a readable date (e.g. "Jun 8, 2026").
export const fmtDate = (key) => {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

// tetr.io marks unranked players with a "z" (unranked) or "?" letter rank.
export const isUnranked = (letterRank) => {
  const r = (letterRank ?? "").toString().toLowerCase().trim();
  return r === "" || r === "z" || r === "?" || r === "-";
};

export const fmtTR = (m) => (isUnranked(m.letterRank) ? "Unranked" : m.tr);

export const fmtStanding = (s) => (s == null || s <= 0 ? "\u2013" : s.toLocaleString());

export const normalizeRank = (rank) => {
  if (!rank) return "placeholder";
  return rank.toLowerCase().replace("+", "plus").replace("-", "minus");
};
