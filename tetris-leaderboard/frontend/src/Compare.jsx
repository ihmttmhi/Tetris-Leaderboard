import React, { useState, useMemo } from "react";

/* ── Derived-stat helpers (ported from sheetBot) ── */

function derivedStats(m) {
  const apm = m.apm || 0;
  const pps = m.pps || 0;
  const vs  = m.vs  || 0;
  if (!pps) return null;

  const app   = apm / 60 / pps;
  const dss   = vs / 100 - apm / 60;
  const dsp   = dss / pps;
  const dsapp = dsp + app;
  const vsapm = apm ? vs / apm : 0;
  const ci    = dsp * 150 + (vsapm - 2) * 50 + (0.6 - app) * 125;
  const ge    = (app * dss / pps) * 2;
  const wapp  = app - 5 * Math.tan(((ci / -30) + 1) * Math.PI / 180);

  // SR-area weights
  const appsrw = 290, ppssrw = 135, dspsrw = 700;
  const srarea = pps * ppssrw + app * appsrw + dsp * dspsrw;
  let sr = 11.2 * Math.atan((srarea - 93) / 130) + 1;
  if (sr <= 0) sr = 0.001;

  // Estimated glicko (from stats)
  const inner = pps * (150 + (vsapm - 1.66) * 35) + app * 290 + dsp * 700;
  let estglicko = 0.000013 * (inner ** 3) - 0.0196 * (inner ** 2) + 12.645 * inner - 1005.4;
  estglicko = estglicko * 0.9211 - 49.086;

  // Playstyle scores (0–1 scale, 0.5 = average)
  const opener = clamp(((((apm / srarea) / (0.069 * 1.0017 ** ((sr ** 5) / 4700) + sr / 360) - 1)
    + (((pps / srarea) / (0.0084264 * (2.14 ** (-2 * (sr / 2.7 + 1.03))) - sr / 5750 + 0.0067) - 1) * 0.75)
    + (((vsapm / (-(((sr - 16) / 36) ** 2) + 2.133) - 1)) * -10)
    + ((app / (0.1368803292 * 1.0024 ** ((sr ** 5) / 2800) + sr / 54) - 1) * 0.75)
    + ((dsp / (0.02136327583 * (14 ** ((sr - 14.75) / 3.9)) + sr / 152 + 0.022) - 1) * -0.25)) / 3.5) + 0.5);

  const plonk = clamp((((ge / (sr / 350 + 0.005948424455 * 3.8 ** ((sr - 6.1) / 4) + 0.006) - 1)
    + (app / (0.1368803292 * 1.0024 ** ((sr ** 5) / 2800) + sr / 54) - 1)
    + ((dsp / (0.02136327583 * (14 ** ((sr - 14.75) / 3.9)) + sr / 152 + 0.022) - 1) * 0.75)
    + (((pps / srarea) / (0.0084264 * (2.14 ** (-2 * (sr / 2.7 + 1.03))) - sr / 5750 + 0.0067) - 1) * -1)) / 2.73) + 0.5);

  const stride = clamp(((((apm / srarea) / (0.069 * 1.0017 ** ((sr ** 5) / 4700) + sr / 360) - 1) * -0.25)
    + ((pps / srarea) / (0.0084264 * (2.14 ** (-2 * (sr / 2.7 + 1.03))) - sr / 5750 + 0.0067) - 1)
    + ((app / (0.1368803292 * 1.0024 ** ((sr ** 5) / 2800) + sr / 54) - 1) * -2)
    + ((dsp / (0.02136327583 * (14 ** ((sr - 14.75) / 3.9)) + sr / 152 + 0.022) - 1) * -0.5)) * 0.79 + 0.5);

  const infds = clamp(((dsp / (0.02136327583 * (14 ** ((sr - 14.75) / 3.9)) + sr / 152 + 0.022) - 1)
    + ((app / (0.1368803292 * 1.0024 ** ((sr ** 5) / 2800) + sr / 54) - 1) * -0.75)
    + (((apm / srarea) / (0.069 * 1.0017 ** ((sr ** 5) / 4700) + sr / 360) - 1) * 0.5)
    + ((vsapm / (-(((sr - 16) / 36) ** 2) + 2.133) - 1) * 1.5)
    + (((pps / srarea) / (0.0084264 * (2.14 ** (-2 * (sr / 2.7 + 1.03))) - sr / 5750 + 0.0067) - 1) * 0.5)) * 0.9 + 0.5);

  // Area weights
  const area = apm * 1 + pps * 45 + vs * 0.444 + app * 185 + dss * 175 + dsp * 450 + ge * 315;

  return { app, dss, dsp, dsapp, vsapm, ci, ge, wapp, area, sr, srarea, estglicko, opener, plonk, stride, infds };
}

function clamp(v) { return Math.max(0, Math.min(1.5, v)); }

/* ── Win probability (Glicko-2 formula from sheetBot) ── */

function winProbability(glicko1, rd1, glicko2, rd2) {
  const Q = 0.0057564273;
  const scaling = 400 * Math.sqrt(1 + 3 * Q * Q * (rd1 * rd1 + rd2 * rd2) / (Math.PI * Math.PI));
  return (1 / (1 + Math.pow(10, (glicko2 - glicko1) / scaling))) * 100;
}

/* ── SVG Radar Chart ── */

function RadarChart({ labels, datasets, maxVal = 1.5, size = 300 }) {
  const cx = size / 2, cy = size / 2;
  const r = size * 0.38;
  const n = labels.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const pointFor = (i, val) => {
    const angle = startAngle + i * angleStep;
    const dist = (val / maxVal) * r;
    return [cx + dist * Math.cos(angle), cy + dist * Math.sin(angle)];
  };

  const gridLevels = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: "100%" }}>
      {/* Grid rings */}
      {gridLevels.map((lev) => {
        const pts = Array.from({ length: n }, (_, i) => pointFor(i, lev).join(",")).join(" ");
        return <polygon key={lev} points={pts} fill="none" stroke="var(--table-border)" strokeWidth="0.5" opacity="0.5" />;
      })}
      {/* Axis lines */}
      {labels.map((_, i) => {
        const [ex, ey] = pointFor(i, maxVal);
        return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke="var(--table-border)" strokeWidth="0.5" opacity="0.5" />;
      })}
      {/* Data polygons */}
      {datasets.map((ds, di) => {
        const pts = Array.from({ length: n }, (_, i) => pointFor(i, ds.data[i]).join(",")).join(" ");
        return (
          <g key={di}>
            <polygon points={pts} fill={ds.color} fillOpacity="0.25" stroke={ds.color} strokeWidth="2" />
            {ds.data.map((val, i) => {
              const [px, py] = pointFor(i, val);
              return <circle key={i} cx={px} cy={py} r="3" fill={ds.color} />;
            })}
          </g>
        );
      })}
      {/* Labels */}
      {labels.map((label, i) => {
        const [lx, ly] = pointFor(i, maxVal + 0.25);
        return (
          <text
            key={i} x={lx} y={ly}
            textAnchor="middle" dominantBaseline="middle"
            fill="var(--text-color)" fontSize="11" fontWeight="600"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Player colors ── */

const P1_COLOR = "#4ea3ff";
const P2_COLOR = "#e74c3c";

/* ── Stat comparison bar ── */

const BETTER_COLOR = "#2ecc71";
const NEUTRAL_COLOR = "#555";

function StatBar({ label, val1, val2, higherIsBetter = true, format }) {
  const fmt = format || ((v) => v == null ? "\u2013" : v.toFixed(2));
  const max = Math.max(Math.abs(val1 || 0), Math.abs(val2 || 0)) || 1;
  const pct1 = ((val1 || 0) / max) * 100;
  const pct2 = ((val2 || 0) / max) * 100;

  const better1 = higherIsBetter ? (val1 || 0) > (val2 || 0) : (val1 || 0) < (val2 || 0);
  const better2 = higherIsBetter ? (val2 || 0) > (val1 || 0) : (val2 || 0) < (val1 || 0);
  const tied = (val1 || 0) === (val2 || 0);

  const bar1Color = tied ? NEUTRAL_COLOR : better1 ? BETTER_COLOR : NEUTRAL_COLOR;
  const bar2Color = tied ? NEUTRAL_COLOR : better2 ? BETTER_COLOR : NEUTRAL_COLOR;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85em", marginBottom: 2 }}>
        <span style={{ fontWeight: better1 ? 700 : 400, color: P1_COLOR }}>{fmt(val1)}</span>
        <span style={{ fontWeight: 600, fontSize: "0.8em", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--footer-color)" }}>{label}</span>
        <span style={{ fontWeight: better2 ? 700 : 400, color: P2_COLOR }}>{fmt(val2)}</span>
      </div>
      <div style={{ display: "flex", gap: 4, height: 6, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", background: "var(--table-row-even)", borderRadius: "3px 0 0 3px" }}>
          <div style={{ width: `${Math.abs(pct1)}%`, background: bar1Color, borderRadius: "3px 0 0 3px", transition: "width 0.3s" }} />
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", background: "var(--table-row-even)", borderRadius: "0 3px 3px 0" }}>
          <div style={{ width: `${Math.abs(pct2)}%`, background: bar2Color, borderRadius: "0 3px 3px 0", transition: "width 0.3s" }} />
        </div>
      </div>
    </div>
  );
}

/* ── Win probability bar ── */

function WinBar({ name1, name2, prob1, label }) {
  const prob2 = 100 - prob1;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: "0.75em", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--footer-color)", marginBottom: 4, textAlign: "center" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: "0.9em", minWidth: 55, textAlign: "right", color: P1_COLOR }}>
          {prob1.toFixed(1)}%
        </span>
        <div style={{ flex: 1, display: "flex", height: 22, borderRadius: 11, overflow: "hidden", border: "1px solid var(--table-border)" }}>
          <div style={{ width: `${prob1}%`, background: P1_COLOR, transition: "width 0.3s" }} />
          <div style={{ width: `${prob2}%`, background: P2_COLOR, transition: "width 0.3s" }} />
        </div>
        <span style={{ fontWeight: 700, fontSize: "0.9em", minWidth: 55, color: P2_COLOR }}>
          {prob2.toFixed(1)}%
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75em", color: "var(--footer-color)", marginTop: 2 }}>
        <span>{name1}</span>
        <span>{name2}</span>
      </div>
    </div>
  );
}

/* ── Playstyle label ── */

function playstyleLabel(opener, plonk, stride, infds) {
  const scores = { Opener: opener, Plonk: plonk, Stride: stride, "Inf DS": infds };
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] - sorted[1][1] > 0.1) return sorted[0][0];
  return `${sorted[0][0]} / ${sorted[1][0]}`;
}

/* ── Player selector dropdown ── */

function PlayerSelect({ members, selected, onChange, label }) {
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <label style={{ display: "block", fontSize: "0.8em", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--footer-color)", marginBottom: 6 }}>
        {label}
      </label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid var(--table-border)",
          background: "var(--table-header-bg)",
          color: "var(--text-color)",
          fontSize: "1em",
          cursor: "pointer",
        }}
      >
        <option value="">-- Select a player --</option>
        {members.map((m) => (
          <option key={m.username} value={m.username}>
            {m.realName || m.username} ({m.username})
          </option>
        ))}
      </select>
    </div>
  );
}

/* ── Rank badge ── */

function RankBadge({ letterRank }) {
  const normalizeRank = (rank) => {
    if (!rank) return "placeholder";
    return rank.toLowerCase().replace("+", "plus").replace("-", "minus");
  };
  return (
    <img
      src={`/ranks/${normalizeRank(letterRank)}.png`}
      alt={letterRank}
      height="28"
      style={{ verticalAlign: "middle" }}
      onError={(e) => { e.target.src = "/ranks/placeholder.png"; }}
    />
  );
}

/* ── Main Compare component ── */

export default function Compare({ members }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");

  const player1 = members.find((m) => m.username === p1);
  const player2 = members.find((m) => m.username === p2);

  const d1 = useMemo(() => player1 ? derivedStats(player1) : null, [player1]);
  const d2 = useMemo(() => player2 ? derivedStats(player2) : null, [player2]);

  const hasGlicko = player1?.glicko && player2?.glicko && player1?.rd && player2?.rd;
  const strictProb = hasGlicko ? winProbability(player1.glicko, player1.rd, player2.glicko, player2.rd) : null;
  const estProb = d1 && d2 ? winProbability(d1.estglicko, player1?.rd || 60, d2.estglicko, player2?.rd || 60) : null;

  const bothSelected = player1 && player2 && d1 && d2;

  const fmtPct = (v) => v == null ? "\u2013" : (v * 100).toFixed(1) + "%";

  return (
    <div>
      <h1 style={{ fontSize: "2.2em", letterSpacing: "-0.02em", marginBottom: 16 }}>Head-to-Head Compare</h1>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <PlayerSelect members={members} selected={p1} onChange={setP1} label="Player 1" />
        <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4, fontWeight: 700, fontSize: "1.2em", color: "var(--footer-color)" }}>VS</div>
        <PlayerSelect members={members} selected={p2} onChange={setP2} label="Player 2" />
      </div>

      {p1 && p2 && p1 === p2 && (
        <div style={{ textAlign: "center", color: "var(--footer-color)", padding: 40, fontSize: "1.1em" }}>
          Please select two different players to compare.
        </div>
      )}

      {bothSelected && p1 !== p2 && (
        <>
          {/* Player headers */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 20px", marginBottom: 20,
            borderRadius: 12, border: "1px solid var(--table-border)",
            background: "linear-gradient(135deg, var(--table-header-bg), var(--table-row-even))",
          }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "1.3em" }}>{player1.realName || player1.username}</div>
              <div style={{ fontSize: "0.85em", color: "var(--footer-color)" }}>
                <a href={`https://ch.tetr.io/u/${player1.username}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--link-color)" }}>
                  {player1.username}
                </a>
              </div>
              <div style={{ marginTop: 4 }}><RankBadge letterRank={player1.letterRank} /></div>
              {d1 && <div style={{ fontSize: "0.75em", color: "var(--footer-color)", marginTop: 4 }}>{playstyleLabel(d1.opener, d1.plonk, d1.stride, d1.infds)}</div>}
            </div>

            <div style={{ fontWeight: 800, fontSize: "1.5em", color: "var(--footer-color)", padding: "0 20px" }}>VS</div>

            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "1.3em" }}>{player2.realName || player2.username}</div>
              <div style={{ fontSize: "0.85em", color: "var(--footer-color)" }}>
                <a href={`https://ch.tetr.io/u/${player2.username}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--link-color)" }}>
                  {player2.username}
                </a>
              </div>
              <div style={{ marginTop: 4 }}><RankBadge letterRank={player2.letterRank} /></div>
              {d2 && <div style={{ fontSize: "0.75em", color: "var(--footer-color)", marginTop: 4 }}>{playstyleLabel(d2.opener, d2.plonk, d2.stride, d2.infds)}</div>}
            </div>
          </div>

          {/* Win probability */}
          <div style={{
            padding: "16px 20px", marginBottom: 20, borderRadius: 12,
            border: "1px solid var(--table-border)", background: "var(--table-row-even)",
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "1em", textTransform: "uppercase", letterSpacing: "0.05em" }}>Win Probability</h3>
            {strictProb != null && (
              <WinBar name1={player1.username} name2={player2.username} prob1={strictProb} label="Based on Glicko Rating" />
            )}
            {estProb != null && (
              <WinBar name1={player1.username} name2={player2.username} prob1={estProb} label="Based on Estimated Glicko (from stats)" />
            )}
            {strictProb == null && estProb == null && (
              <div style={{ color: "var(--footer-color)", fontSize: "0.9em", textAlign: "center" }}>
                Insufficient rating data to calculate win probability.
              </div>
            )}
          </div>

          {/* Playstyle radar chart */}
          <div style={{
            padding: "16px 20px", marginBottom: 20, borderRadius: 12,
            border: "1px solid var(--table-border)", background: "var(--table-row-even)",
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "1em", textTransform: "uppercase", letterSpacing: "0.05em" }}>Playstyle Comparison</h3>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <RadarChart
                labels={["OPENER", "STRIDE", "INF DS", "PLONK"]}
                datasets={[
                  { data: [d1.opener, d1.stride, d1.infds, d1.plonk], color: P1_COLOR },
                  { data: [d2.opener, d2.stride, d2.infds, d2.plonk], color: P2_COLOR },
                ]}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 8, fontSize: "0.85em" }}>
              <span><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: P1_COLOR, marginRight: 6, verticalAlign: "middle" }} />{player1.username}</span>
              <span><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: P2_COLOR, marginRight: 6, verticalAlign: "middle" }} />{player2.username}</span>
            </div>
          </div>

          {/* Stat-by-stat comparison bars */}
          <div style={{
            padding: "16px 20px", marginBottom: 20, borderRadius: 12,
            border: "1px solid var(--table-border)", background: "var(--table-row-even)",
          }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "1em", textTransform: "uppercase", letterSpacing: "0.05em" }}>Stat Comparison</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14, fontSize: "0.75em", color: "var(--footer-color)" }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: BETTER_COLOR, marginRight: 4, verticalAlign: "middle" }} />Better value</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: P1_COLOR, marginRight: 4, verticalAlign: "middle" }} />Player 1</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: P2_COLOR, marginRight: 4, verticalAlign: "middle" }} />Player 2</span>
            </div>

            <h4 style={{ margin: "12px 0 8px", fontSize: "0.85em", color: "var(--footer-color)", textTransform: "uppercase" }}>Core Stats</h4>
            <StatBar label="TR" val1={player1.tr} val2={player2.tr} format={(v) => v ? v.toFixed(2) : "\u2013"} />
            <StatBar label="PPS" val1={player1.pps} val2={player2.pps} />
            <StatBar label="APM" val1={player1.apm} val2={player2.apm} />
            <StatBar label="VS" val1={player1.vs} val2={player2.vs} />
            <StatBar label="Win Rate" val1={player1.gamesPlayed ? player1.gamesWon / player1.gamesPlayed : null} val2={player2.gamesPlayed ? player2.gamesWon / player2.gamesPlayed : null} format={fmtPct} />

            <h4 style={{ margin: "16px 0 8px", fontSize: "0.85em", color: "var(--footer-color)", textTransform: "uppercase" }}>Derived Stats</h4>
            <StatBar label="APP" val1={d1.app} val2={d2.app} />
            <StatBar label="DS/Second" val1={d1.dss} val2={d2.dss} />
            <StatBar label="DS/Piece" val1={d1.dsp} val2={d2.dsp} />
            <StatBar label="APP+DSP" val1={d1.dsapp} val2={d2.dsapp} />
            <StatBar label="VS/APM" val1={d1.vsapm} val2={d2.vsapm} />
            <StatBar label="Cheese Index" val1={d1.ci} val2={d2.ci} higherIsBetter={false} />
            <StatBar label="Garbage Effi." val1={d1.ge} val2={d2.ge} />
            <StatBar label="Weighted APP" val1={d1.wapp} val2={d2.wapp} />
            <StatBar label="Area" val1={d1.area} val2={d2.area} />

            <h4 style={{ margin: "16px 0 8px", fontSize: "0.85em", color: "var(--footer-color)", textTransform: "uppercase" }}>Playstyle Scores</h4>
            <StatBar label="Opener" val1={d1.opener} val2={d2.opener} />
            <StatBar label="Plonk" val1={d1.plonk} val2={d2.plonk} />
            <StatBar label="Stride" val1={d1.stride} val2={d2.stride} />
            <StatBar label="Inf DS" val1={d1.infds} val2={d2.infds} />
          </div>

          {/* Glicko details */}
          {(player1.glicko || player2.glicko) && (
            <div style={{
              padding: "16px 20px", marginBottom: 20, borderRadius: 12,
              border: "1px solid var(--table-border)", background: "var(--table-row-even)",
            }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "1em", textTransform: "uppercase", letterSpacing: "0.05em" }}>Rating Details</h3>
              <StatBar label="Glicko" val1={player1.glicko} val2={player2.glicko} format={(v) => v ? Math.round(v).toLocaleString() : "\u2013"} />
              <StatBar label="RD" val1={player1.rd} val2={player2.rd} higherIsBetter={false} format={(v) => v ? Math.round(v).toString() : "\u2013"} />
              <StatBar label="Est. Glicko" val1={d1.estglicko} val2={d2.estglicko} format={(v) => v ? Math.round(v).toLocaleString() : "\u2013"} />
            </div>
          )}
        </>
      )}

      {!bothSelected && !(p1 && p2 && p1 === p2) && (
        <div style={{ textAlign: "center", color: "var(--footer-color)", padding: 60, fontSize: "1.1em" }}>
          Select two players above to compare their stats head-to-head.
        </div>
      )}
    </div>
  );
}
