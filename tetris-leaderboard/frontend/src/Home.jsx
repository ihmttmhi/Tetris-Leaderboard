import React from "react";
import { Link } from "react-router-dom";

const cardStyle = {
  padding: "20px 24px",
  borderRadius: "10px",
  border: "1px solid var(--table-border)",
  background: "var(--table-header-bg)",
  color: "var(--text-color)",
  marginBottom: "16px",
};

const pages = [
  {
    to: "/rankings",
    title: "Rankings",
    desc: "Real-time multi-mode leaderboard (Tetra League, 40L, Blitz, Quick Play, Expert QP, All-Time QP) with live SSE updates, daily change arrows, search, and a latest news feed of recent achievements.",
  },
  {
    to: "/compare",
    title: "Compare",
    desc: "Head-to-head player comparison featuring a 10-axis spider web radar chart, playstyle diamond chart, side-by-side stat bars with green=better highlighting, and Glicko-based win probability.",
  },
  {
    to: "/resources",
    title: "Resources",
    desc: "A curated collection of TETR.IO modern Tetris learning resources — openers, stacking methods, spins, videos, Quick Play guides, and community tools.",
  },
];

export default function Home() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", fontSize: "2.2em", letterSpacing: "-0.02em", marginBottom: 24 }}>
        UTS Tetris Elite
      </h1>

      <h2 style={{ marginBottom: 12 }}>Pages</h2>
      {pages.map((p) => (
        <div key={p.to} style={cardStyle}>
          <Link
            to={p.to}
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: "var(--link-color)",
            }}
          >
            {p.title}
          </Link>
          <p style={{ margin: "8px 0 0", lineHeight: 1.5 }}>{p.desc}</p>
        </div>
      ))}
    </div>
  );
}
