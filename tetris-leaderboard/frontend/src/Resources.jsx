import React from "react";

const listStyle = {
  listStyleType: "disc",
  paddingLeft: 24,
  lineHeight: 1.8,
};

const cardStyle = {
  padding: "16px 20px",
  borderRadius: "10px",
  border: "1px solid var(--table-border)",
  background: "var(--table-header-bg)",
  color: "var(--text-color)",
  marginBottom: 16,
};

function ExtLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export default function Resources() {
  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", marginBottom: 8 }}>
        TETR.IO Resources
      </h1>
      <p
        style={{
          textAlign: "center",
          color: "var(--footer-color)",
          marginBottom: 32,
        }}
      >
        A curated collection of modern Tetris learning resources for competitive
        TETR.IO play.
      </p>

      {/* Openers */}
      <div style={cardStyle}>
        <h2>Openers</h2>
        <ul style={listStyle}>
          <li>
            <ExtLink href="https://four.lol/openers/tki">
              TKI / DT Cannon
            </ExtLink>{" "}
            — versatile T-spin double opener
          </li>
          <li>
            <ExtLink href="https://four.lol/openers/mko">MKO</ExtLink> —
            Mechanical Knock-Out opener
          </li>
          <li>
            <ExtLink href="https://four.lol/openers/hachispin">
              Hachispin
            </ExtLink>{" "}
            — strong all-spin opener
          </li>
          <li>
            <ExtLink href="https://four.lol/openers/albatross-special">
              Albatross
            </ExtLink>{" "}
            — back-to-back T-spin opener
          </li>
          <li>
            <ExtLink href="https://four.lol/openers/mr-t-spin">
              Mr. T-Spin
            </ExtLink>{" "}
            — quick TSD opener
          </li>
          <li>
            <ExtLink href="https://harddrop.com/wiki/TSD_Openers">
              TSD Openers Overview (Hard Drop Wiki)
            </ExtLink>
          </li>
          <li>
            <ExtLink href="https://four.lol/openers">
              All Openers (four.lol)
            </ExtLink>
          </li>
        </ul>
      </div>

      {/* Stacking Methods */}
      <div style={cardStyle}>
        <h2>Stacking Methods</h2>
        <ul style={listStyle}>
          <li>
            <ExtLink href="https://four.lol/stacking/flat-stacking">
              Flat Stacking
            </ExtLink>{" "}
            — keeping a flat board for flexibility
          </li>
          <li>
            <ExtLink href="https://harddrop.com/wiki/9-0_Stacking">
              9-0 Stacking (Hard Drop Wiki)
            </ExtLink>{" "}
            — single-well right-side stacking
          </li>
          <li>
            <ExtLink href="https://four.lol/stacking/centre-well">
              Center-Well Stacking
            </ExtLink>{" "}
            — T-spin-friendly centre column well
          </li>
          <li>
            <ExtLink href="https://harddrop.com/fumen/">
              Fumen Editor (Hard Drop)
            </ExtLink>{" "}
            — visual board diagram tool for practice setups
          </li>
        </ul>
      </div>

      {/* Spins */}
      <div style={cardStyle}>
        <h2>Spins</h2>
        <ul style={listStyle}>
          <li>
            <ExtLink href="https://four.lol/t-spins/overview">
              T-Spins Overview
            </ExtLink>{" "}
            — single, double, triple setups
          </li>
          <li>
            <ExtLink href="https://four.lol/t-spins/recognition">
              T-Spin Recognition
            </ExtLink>{" "}
            — learning to spot T-spin slots in your board
          </li>
          <li>
            <ExtLink href="https://four.lol/all-spins">
              All-Spins Guide (four.lol)
            </ExtLink>{" "}
            — S, Z, L, J, I spins for modern all-spin guidelines
          </li>
          <li>
            <ExtLink href="https://harddrop.com/wiki/T-Spin">
              T-Spin (Hard Drop Wiki)
            </ExtLink>{" "}
            — comprehensive reference with diagrams
          </li>
          <li>
            <ExtLink href="https://harddrop.com/wiki/SRS">
              SRS Rotation System (Hard Drop Wiki)
            </ExtLink>{" "}
            — the kick table behind all modern spins
          </li>
        </ul>
      </div>

      {/* Videos */}
      <div style={cardStyle}>
        <h2>Videos</h2>
        <ul style={listStyle}>
          <li>
            <ExtLink href="https://www.youtube.com/@kirjavik">
              kirjav (YouTube)
            </ExtLink>{" "}
            — high-level gameplay commentary and tutorials
          </li>
          <li>
            <ExtLink href="https://www.youtube.com/@DPMasterTetris">
              doremy's piece (YouTube)
            </ExtLink>{" "}
            — strategy guides and advanced techniques
          </li>
          <li>
            <ExtLink href="https://www.youtube.com/@garbo_openers">
              Garbo (YouTube)
            </ExtLink>{" "}
            — opener showcases and competitive analysis
          </li>
          <li>
            <ExtLink href="https://www.youtube.com/results?search_query=tetris+beginner+guide">
              Beginner Guides (YouTube Search)
            </ExtLink>{" "}
            — getting started with modern Tetris
          </li>
          <li>
            <ExtLink href="https://www.youtube.com/@HardDropTetris">
              Hard Drop (YouTube)
            </ExtLink>{" "}
            — tournament broadcasts and tutorials
          </li>
        </ul>
      </div>

      {/* Quick Play / Zenith */}
      <div style={cardStyle}>
        <h2>Galactoid / Quick Play (Zenith)</h2>
        <ul style={listStyle}>
          <li>
            <ExtLink href="https://tetrio.team2xh.net/?t=zenith">
              Zenith Leaderboard (community tracker)
            </ExtLink>{" "}
            — live Quick Play rankings and stats
          </li>
          <li>
            <ExtLink href="https://www.reddit.com/r/Tetris/search/?q=zenith+guide">
              Zenith Guides (Reddit)
            </ExtLink>{" "}
            — community tips for climbing floors
          </li>
          <li>
            <ExtLink href="https://tetris.wiki/TETR.IO#Quick_Play">
              TETR.IO Quick Play (Tetris Wiki)
            </ExtLink>{" "}
            — mode overview and mechanics
          </li>
        </ul>
      </div>

      {/* General Tools */}
      <div style={cardStyle}>
        <h2>General Tools</h2>
        <ul style={listStyle}>
          <li>
            <ExtLink href="https://four.lol">four.lol</ExtLink> —
            comprehensive modern Tetris strategy wiki
          </li>
          <li>
            <ExtLink href="https://harddrop.com/wiki/Tetris_Wiki">
              Hard Drop Wiki
            </ExtLink>{" "}
            — the original Tetris community knowledge base
          </li>
          <li>
            <ExtLink href="https://discord.gg/tetrio">
              TETR.IO Discord
            </ExtLink>{" "}
            — official community server
          </li>
          <li>
            <ExtLink href="https://harddrop.com/fumen/">
              Fumen Editor
            </ExtLink>{" "}
            — create and share board diagrams
          </li>
          <li>
            <ExtLink href="https://jstris.jezevec10.com/">Jstris</ExtLink> —
            browser-based Tetris for practice
          </li>
          <li>
            <ExtLink href="https://tetr.io">TETR.IO</ExtLink> — the game
            itself
          </li>
          <li>
            <ExtLink href="https://ch.tetr.io/">
              TETR.IO Channel API
            </ExtLink>{" "}
            — public stats and leaderboard API
          </li>
        </ul>
      </div>
    </div>
  );
}
