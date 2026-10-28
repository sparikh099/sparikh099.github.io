(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Free key from https://web3forms.com (enter your email there; the key is safe to keep in the page).
  // Until a key is set, the form can't send and says so.
  const FORM_KEY = "";
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }

  /* ---------------- the drive ---------------- */
  // yard = distance from own goal line (0..100)
  const plays = [
    {
      yard: 20, short: "Truthifi",
      pbp: "The kickoff is fielded at the 20, and the drive starts in Princeton.",
      org: "Truthifi", role: "Software Engineering Intern", when: "Feb 2023 – May 2025", where: "Princeton, NJ",
      pts: [
        "Pulled ESG data for stocks and bonds to see how companies were following ESG principles.",
        "Built an uptime and availability monitor for the team's main application.",
        "Wrote and tested production data ingestion jobs that load data into MongoDB.",
        "Automated redacting and extracting data from financial statements in Python.",
      ],
    },
    {
      yard: 34, short: "Hanlon Center",
      pbp: "A handoff up the middle goes for 14 yards and a first down.",
      org: "Hanlon Financial Systems Center", role: "Undergraduate Student Researcher", when: "May 2024 – Jan 2025", where: "Hoboken, NJ",
      pts: [
        "Researched automated market making using ideas from traditional finance.",
        "Queried CRSP and Yahoo Finance data for the stocks in the Dow Jones Industrial Average.",
        "Built market-weighted and price-weighted versions of the Dow to test trading ideas.",
      ],
    },
    {
      yard: 51, short: "Stevens SMIF",
      pbp: "A short pass over the middle crosses midfield.",
      org: "Stevens Student Managed Investment Fund", role: "Head of Quantitative Investment Solutions", when: "Jan 2025 – May 2025", where: "Hoboken, NJ",
      pts: [
        "Worked with a team of 30 students on a factor model to support the equity research team.",
        "Presented a proposal to the Stevens Endowment Board to let the fund add fixed-income ETFs.",
        "Modeled volatility for sector ETFs with GARCH.",
      ],
    },
    {
      yard: 66, short: "Susquehanna",
      pbp: "Play-action, and a completion on the sideline for 15 yards.",
      org: "Susquehanna International Group", role: "Operations Intern", when: "Jun 2025 – Aug 2025", where: "Bala Cynwyd, PA",
      pts: [
        "Built trade reconciliation reporting tools for the Index and Equity Options desk.",
        "Used Python, SQL, and VBA to automate daily P&L tasks and build dashboards.",
        "Took an options course on strategies, payoffs, and the Greeks.",
        "Built a regression framework to forecast securities lending rates for small-cap companies.",
      ],
    },
    {
      yard: 81, short: "Astoria",
      pbp: "The drive reaches the red zone in New York City.",
      org: "Astoria Investment Management", role: "Portfolio Management Intern", when: "Nov 2025 – May 2026", where: "New York, NY",
      pts: [
        "Built a macro risk dashboard, an earnings monitor, and a portfolio analytics tool in Python and HTML.",
        "Helped write the firm's monthly commentary on the economy and markets.",
        "Automated weekly report emails for the Astoria ETFs with VBA.",
        "Ran historical backtests to understand the ETF suite's returns and risk.",
      ],
    },
    {
      yard: 95, short: "CTC Internship",
      pbp: "A long completion in Chicago sets up first and goal.",
      org: "Chicago Trading Company", role: "Summer Intern", when: "Jun 2026 – Aug 2026", where: "Chicago, IL",
      pts: [
        "Worked on projects for an options desk, focusing on customer flow.",
        "Used Claude Code and other AI tools to speed up everyday desk processes.",
        "Completed an options and mock trading course.",
        "Built a mock trading practice tool for interns and associates.",
      ],
    },
    {
      yard: 100, short: "What's next", td: true,
      pbp: "Touchdown. The next stop is Chicago.",
      org: "Chicago Trading Company", role: "Joining full time", when: "March 2027", where: "Chicago, IL",
      pts: ["Returning to Chicago Trading Company full time."],
    },
  ];

  const tabs = $("#playTabs");
  plays.forEach((pl, i) => tabs.insertAdjacentHTML("beforeend", `<button data-i="${i}" id="play-${i}">${pl.short}</button>`));
  const LAST = plays.length - 1;
  let cur = 0;

  function showPlayCard(i) {
    const pl = plays[i];
    tabs.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-pressed", j === i));
    const card = $("#playCard");
    card.classList.toggle("td", !!pl.td);
    card.innerHTML = `
      <p class="pbp">${pl.pbp}</p>
      <h3>${pl.org}</h3>
      <p class="role">${pl.role}</p>
      <p class="meta">${pl.when} · ${pl.where}</p>
      <ul>${pl.pts.map((t) => `<li>${t}</li>`).join("")}</ul>`;
  }

  /* ---- the football game ----
     World units are yards: x runs from our goal line (0) to theirs (100), y from sideline to sideline (0–53.3).
     The camera shows 30 yards of field height and pans along x.
     Real downs: four tries to gain 10 yards (or reach the goal line). The ball moves by the actual yardage
     gained; each job is a yard line along the way. A failed fourth down, an interception or a safety
     sends the drive back to the 20. */
  const fc = $("#gridironCanvas"), fx = fc.getContext("2d");
  const MID = 26.65, SPAN = 30, Y0 = MID - SPAN / 2;
  const BALL_SPEED = 24, CATCH_R = 2.4, TACKLE_R = 1.05;
  const OFF = { body: "#0b2265", helm: "#1a3a94", trim: "#c8102e" };
  const DEF = { body: "#eef1f5", helm: "#c3cad4", trim: "#56606e" };
  // 2026 Giants offense (Ourlads depth chart, Oct 26, 2026)
  const QB = { name: "McCarthy", num: 18 };
  const RB = { name: "Skattebo", num: 44, x: -5, y: 1.6, dir: 1, speed: 7.9 };
  const TARGETS = [
    { name: "Nabers", num: 1, y: -11, dir: 1, x: -0.5, speed: 8.3 },    // left wide receiver
    { name: "Mooney", num: 17, y: -6, dir: 1, x: -1.2, speed: 8.2 },    // slot
    { name: "Likely", num: 9, y: 3.8, dir: -1, x: -0.8, speed: 7.6 },   // tight end
    { name: "Fields", num: 88, y: 11, dir: -1, x: -0.5, speed: 8.0 },   // right wide receiver
  ];
  const LINE = [78, 76, 61, 65, 72]; // Thomas, Runyan, Schmitz, Mauigoa, Eluemunor
  // Route legs: [yards downfield, yards toward the middle of the field]
  const ROUTES = [
    [[26, 0]],                 // go
    [[3, 0], [16, 6]],         // slant
    [[9, 0], [24, 6]],         // post
    [[9, 0], [9, -3.5]],       // out
    [[13, 0], [-2.5, 1]],      // curl
    [[9, 0], [20, -3.5]],      // corner
    [[11, 0], [11, 8]],        // dig
    [[6, 0], [6, 3]],          // short hitch-and-in
  ];
  const CALLS = {
    pass: { label: "Pass", live: "Tap where you want to throw, and lead your receiver. Keys 1–5 pick a receiver." },
    pa: { label: "Play action", live: `Fake to ${RB.name}... the defense bites. Now find an open receiver.` },
    run: { label: "Run", live: `Handoff to ${RB.name}. Hold ↑ ↓ (or W S) to weave through defenders, → to burst, ← to wait for blocks, and Space to juke.` },
    screen: { label: "Screen", live: `Screen to ${RB.name}. Let the rush come, then dump it off. Key 5 throws to him.` },
  };
  const ORD = ["", "1st", "2nd", "3rd", "4th"];
  let FW = 0, FH = 0, S = 1;
  const g = {
    state: "pre", call: "pass", lastCall: "pass", t: 0, los: 20, down: 1, fd: 30, camX: 0, wait: 0, after: null, aim: null,
    ball: null, carrier: null, carryT: 0, steerY: null, juke: 0, jukeDir: 0, jukes: 2, immune: 0,
    qb: null, rb: null, recv: [], defs: [], rush: [], line: [], rings: [],
  };
  const msg = (text) => { $("#fieldMsg").textContent = text; };
  const visW = () => FW / S;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clampY = (y) => Math.max(Y0 + 1, Math.min(Y0 + SPAN - 1, y));
  const spot = (x) => (x < 50 ? `OWN ${x}` : x === 50 ? "MIDFIELD" : `OPP ${100 - x}`);
  const nextStop = () => plays[cur + 1];
  const stopLine = () => (nextStop().td ? 100 : nextStop().yard);

  function sizeField() {
    const dpr = window.devicePixelRatio || 1;
    FW = fc.clientWidth;
    FH = Math.round(Math.min(440, Math.max(260, FW * 0.48)));
    fc.width = Math.round(FW * dpr); fc.height = Math.round(FH * dpr);
    fc.style.height = FH + "px";
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = FH / SPAN;
  }
  const camTarget = (x) => Math.max(-10, Math.min(110 - visW(), x - visW() * 0.3));
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function showDown() {
    const togo = g.fd >= 100 ? "Goal" : g.fd - g.los;
    $("#downDist").textContent = `${ORD[g.down]} & ${togo} · ${spot(g.los)}`;
  }
  function setCallable(on) {
    document.querySelectorAll("#playcall button").forEach((b) => {
      b.disabled = !on;
      b.classList.toggle("last", on && b.dataset.call === g.lastCall);
    });
  }

  function makeReceiver(t, los, legs, key) {
    const x = los + t.x, y = MID + t.y;
    const pts = [{ x, y }];
    legs.forEach(([dx, dy]) => { const p = pts[pts.length - 1]; pts.push({ x: p.x + dx, y: p.y + dy * t.dir }); });
    return { x, y, pts, key, name: t.name, num: t.num, speed: t.speed, face: 0 };
  }
  function routePos(r, t) {
    let d = Math.max(0, t - (r.delay || 0.15)) * r.speed;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i], len = dist(a, b);
      if (d <= len) return { x: a.x + (b.x - a.x) * (d / len), y: a.y + (b.y - a.y) * (d / len), face: Math.atan2(b.y - a.y, b.x - a.x) };
      d -= len;
    }
    const e = r.pts[r.pts.length - 1];
    return { x: e.x, y: e.y, face: Math.PI };
  }

  function resetFormation() {
    const los = g.los;
    Object.assign(g, { t: 0, ball: null, carrier: null, aim: null, rings: [], steerY: null, juke: 0, jukes: 2, immune: 0, carryT: 0 });
    g.qb = { x: los - 1, y: MID, face: 0, name: QB.name, num: QB.num, speed: 6.5 };
    g.rb = { x: los + RB.x, y: MID + RB.y, face: 0, name: RB.name, num: RB.num, speed: RB.speed };
    const legs = shuffle(ROUTES.slice());
    g.recv = TARGETS.map((t, i) => makeReceiver(t, los, legs[i], i + 1));
    // every defender gets a little random speed so no two plays go the same way
    const jit = () => (Math.random() - 0.5) * 0.9;
    g.defs = g.recv.map((r) => ({ x: r.x + 7, y: r.y, face: Math.PI, role: "cover", cover: r, jit: jit() }));
    g.defs.push({ x: los + 15, y: MID - 7, y0: MID - 7, face: Math.PI, role: "safety", jit: jit() });
    g.defs.push({ x: los + 15, y: MID + 7, y0: MID + 7, face: Math.PI, role: "safety", jit: jit() });
    g.rush = [{ x: los + 0.9, y: MID - 1.4, face: Math.PI, role: "rush", jit: jit() }, { x: los + 0.9, y: MID + 1.4, face: Math.PI, role: "rush", jit: jit() }];
    g.line = LINE.map((num, i) => ({ x: los - 0.8, y: MID + (i - 2) * 1.6, face: 0, num }));
  }

  // Line up at the current spot and wait for a play call.
  function lineUp() {
    resetFormation();
    g.state = "pre";
    showDown();
    setCallable(true);
    const stop = nextStop().td ? "the end zone" : nextStop().short;
    msg(g.down === 4 ? `Fourth down. Convert, or the drive starts over. Call a play.` : `Call a play. Next stop: ${stop}.`);
  }

  // Start the drive (or jump straight to the touchdown scene for the last card).
  function setPlay(i, instant) {
    cur = Math.max(0, Math.min(LAST, i));
    showPlayCard(cur);
    if (cur === LAST) {
      g.los = 95; resetFormation();
      g.carrier = g.recv[0]; g.carrier.x = 104; g.carrier.y = MID;
      g.state = "td";
      setCallable(false);
      $("#downDist").textContent = "TOUCHDOWN";
      msg("Touchdown. Tap the field or press Space to run the drive again.");
    } else {
      g.los = plays[cur].yard; g.down = 1; g.fd = Math.min(100, g.los + 10);
      lineUp();
    }
    if (instant) g.camX = camTarget(g.state === "td" ? 100 : g.los);
  }

  function restartDrive(text) {
    g.state = "dead"; g.wait = 2.8; g.after = () => setPlay(0);
    setCallable(false);
    msg(text);
    $("#downDist").textContent = "TURNOVER";
  }

  // Spot the ball after a play. newX is where the play ended (null for an incompletion).
  function endPlay(text, newX) {
    if (newX !== null && newX !== undefined) {
      if (newX >= 100) return touchdown();
      const sp = Math.round(newX);
      if (sp <= 0) return restartDrive(`${text} That's a safety, so the drive starts over.`);
      g.los = sp;
    }
    let reached = "";
    while (nextStop() && !nextStop().td && g.los >= nextStop().yard) { cur++; reached = plays[cur].short; }
    if (reached) { showPlayCard(cur); text += ` The drive reaches ${reached}.`; }
    if (g.los >= g.fd) {
      g.down = 1; g.fd = Math.min(100, g.los + 10);
      text += " First down!";
    } else if (g.down === 4) {
      return restartDrive(`${text} Turnover on downs, so the drive starts over from your own 20.`);
    } else g.down++;
    g.state = "dead"; g.wait = 1.9; g.after = lineUp;
    msg(text);
  }

  function touchdown() {
    cur = LAST; showPlayCard(LAST);
    g.state = "td";
    $("#downDist").textContent = "TOUCHDOWN";
    msg(`Touchdown, ${g.carrier ? g.carrier.name : "Giants"}! Tap the field or press Space to run the drive again.`);
    confetti(["#c8102e", "#0b2265", "#ffffff"]);
  }

  /* -- calling and running plays -- */
  function callPlay(type) {
    if (g.state !== "pre") return;
    g.call = type; g.lastCall = type;
    setCallable(false);
    g.t = 0;
    if (type === "pass" || type === "screen") {
      const legs = type === "screen" ? [[-1, 0], [0, 8], [2, 0]] : [[2, 0], [5, 7]];
      const back = makeReceiver(RB, g.los, legs, 5);
      if (type === "screen") { back.speed = 6; back.delay = 0.35; }
      g.recv.push(back);
      g.rb = null;
    }
    if (type === "run") g.recv.forEach((r) => { r.pts = [{ x: r.x, y: r.y }, { x: r.x + 4, y: r.y }]; });
    if (type === "screen") g.recv.forEach((r) => { if (r.key < 5) r.pts = [{ x: r.x, y: r.y }, { x: r.x + 3, y: r.y }]; });
    g.state = type === "run" ? "handoff" : "live";
    msg(CALLS[type].live);
  }

  function throwTo(tx, ty, target) {
    if (g.state !== "live" || (g.call === "pa" && g.t < 0.75)) return;
    const q = g.qb;
    tx = Math.min(109, tx); ty = Math.max(1, Math.min(52.3, ty));
    const d = Math.hypot(tx - q.x, ty - q.y);
    g.ball = { fx: q.x + 0.6, fy: q.y, tx, ty, x: q.x, y: q.y, z: 0, t0: g.t, dur: 0.3 + d / BALL_SPEED, h: Math.min(6, 1 + d * 0.13) };
    const T = { x: tx, y: ty };
    g.ball.intended = target || g.recv.reduce((a, r) => (dist(routePos(r, g.t + g.ball.dur), T) < dist(routePos(a, g.t + g.ball.dur), T) ? r : a));
    g.state = "air";
    msg(`${QB.name} throws for ${g.ball.intended.name}...`);
  }
  function throwToReceiver(key) {
    const r = g.recv.find((x) => x.key === key);
    if (!r || g.state !== "live") return;
    let tau = 0.6, p;
    for (let k = 0; k < 6; k++) { p = routePos(r, g.t + tau); tau = 0.3 + Math.hypot(p.x - g.qb.x, p.y - g.qb.y) / BALL_SPEED; }
    p = routePos(r, g.t + tau);
    throwTo(p.x + 0.4, p.y, r);
  }

  function startCarry(c, text) {
    Object.keys(held).forEach((k) => (held[k] = false));
    g.carrier = c; g.state = "carry"; g.carryT = 0; g.steerY = null; g.jukes = 2;
    c.speed = Math.min(c.speed, c === g.rb ? 7.9 : 7.6); // nobody runs as fast with the ball in their hands
    msg(text);
  }
  function juke() {
    if (g.state !== "carry" || g.jukes <= 0 || g.juke > 0) return;
    const c = g.carrier;
    const near = [...g.defs, ...g.rush].reduce((a, d) => (dist(d, c) < dist(a, c) ? d : a));
    g.jukeDir = near.y > c.y ? -1 : 1;
    if ((c.y < Y0 + 3 && g.jukeDir < 0) || (c.y > Y0 + SPAN - 3 && g.jukeDir > 0)) g.jukeDir *= -1;
    g.juke = 0.22; g.immune = 0.5; g.jukes--;
    g.rings.push({ x: c.x, y: c.y, t: 0.35 });
  }

  function resolve() {
    const T = { x: g.ball.tx, y: g.ball.ty };
    const who = g.ball.intended;
    let best = null, bd = Infinity, dd = Infinity;
    g.recv.forEach((r) => { const d = dist(r, T); if (d < bd) { bd = d; best = r; } });
    g.defs.forEach((d) => { dd = Math.min(dd, dist(d, T)); });
    g.ball = null;
    if (bd <= CATCH_R) {
      if (dd < 1.0 && dd < bd * 0.8) return endPlay(`Pass to ${best.name} is broken up.`, null);
      g.rings.push({ x: best.x, y: best.y, t: 0 });
      return startCarry(best, `${best.name} makes the catch! Hold ↑ ↓ (or W S) to weave through defenders, and press Space to juke.`);
    }
    if (dd < 1.6) return restartDrive(`Intercepted on the pass to ${who.name}. That's a turnover, so the drive starts over.`);
    endPlay(`Pass intended for ${who.name} is incomplete.`, null);
  }

  function moveToward(p, tx, ty, maxStep) {
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d < 1e-3) return;
    const s = Math.min(maxStep, d);
    p.x += (dx / d) * s; p.y += (dy / d) * s;
    p.face = Math.atan2(dy, dx);
  }
  const blocked = (d) => g.line.some((l) => dist(l, d) < 1.45) || g.recv.some((r) => r !== g.carrier && dist(r, d) < 1.3);
  // how fast each defender closes on the ball carrier, by play type
  function pursuit(d) {
    const run = g.call === "run", screen = g.call === "screen";
    const base = d.role === "rush" ? (screen ? 3 : 5.2) : d.role === "safety" ? 8.0 : run || screen ? 6.6 : 7.4;
    return (base + d.jit) * (blocked(d) ? 0.2 : 1);
  }
  // on runs and screens the defense needs a moment to read the play
  const reading = (d) => (g.call === "run" && (d.role === "rush" ? g.t < 1.2 : g.t < 0.9)) || (g.call === "screen" && d.role === "cover" && g.carryT < 0.7);

  function updateDefense(dt) {
    const pa = g.call === "pa" && g.t < 0.9;
    g.defs.forEach((d) => {
      if (pa) { moveToward(d, g.los + (d.role === "safety" ? 12 : 3), d.y, 4 * dt); return; } // biting on the fake
      // safeties react to the throw once the ball is halfway there
      const ballHalf = g.ball && g.t - g.ball.t0 > g.ball.dur * 0.5;
      if (d.role === "safety") moveToward(d, ballHalf ? g.ball.tx : d.x, ballHalf ? g.ball.ty : d.y0, (ballHalf ? 5.6 + d.jit : 3) * dt);
      else { const lag = routePos(d.cover, g.t - 0.5); moveToward(d, lag.x + 1.5, lag.y, 7 * dt); }
    });
    const rushStart = g.call === "pa" ? 1.3 : g.call === "screen" ? 0.3 : 0.6;
    const rushSpeed = g.call === "screen" ? 2.6 : g.call === "pa" ? 1.7 : 1.45;
    if (g.t > rushStart) g.rush.forEach((r, i) => moveToward(r, g.qb.x, g.qb.y + (i ? 0.6 : -0.6), rushSpeed * dt));
  }

  function update(dt) {
    g.rings.forEach((r) => (r.t += dt));
    g.rings = g.rings.filter((r) => r.t < 0.7);
    const st = g.state;

    if (st === "live" || st === "air") {
      g.t += dt;
      g.recv.forEach((r) => { const p = routePos(r, g.t); r.x = p.x; r.y = p.y; r.face = p.face; });
      if (g.call === "pa") {
        // fake handoff, then a deeper drop
        g.qb.x = g.t < 0.7 ? g.los - 1 - Math.min(1.5, g.t * 4) : g.los - 2.5 - Math.min(5, (g.t - 0.7) * 6);
        g.qb.face = g.t < 0.7 ? Math.PI / 2 : 0;
        if (g.rb) moveToward(g.rb, g.los - 1, MID - 5, 6 * dt);
      } else g.qb.x = g.los - 1 - Math.min(g.call === "screen" ? 3 : 5, g.t * 6);
      if (g.call === "screen" && g.t > 0.8) g.line.forEach((l) => moveToward(l, g.los + 2.5, l.y + (l.y - MID) * 0.4, 4 * dt));
      else g.line.forEach((l) => { l.x = g.los - 0.8 - Math.min(2.2, g.t * 0.45); });
      updateDefense(dt);
      if (st === "live" && g.rush.some((r) => dist(r, g.qb) < 1.3)) {
        g.carrier = g.qb;
        return endPlay(`${QB.name} is sacked for a loss of ${g.los - Math.round(g.qb.x)}.`, g.qb.x);
      }
      if (st === "air") {
        const b = g.ball, u = Math.min(1, (g.t - b.t0) / b.dur);
        b.x = b.fx + (b.tx - b.fx) * u; b.y = b.fy + (b.ty - b.fy) * u; b.z = 4 * b.h * u * (1 - u);
        if (u >= 1) resolve();
      }
    } else if (st === "handoff") {
      g.t += dt;
      moveToward(g.qb, g.los - 2.5, MID + 0.6, 6 * dt);
      moveToward(g.rb, g.los - 2.5, MID + 1.2, 7 * dt);
      g.recv.forEach((r) => { const p = routePos(r, g.t); r.x = p.x; r.y = p.y; r.face = p.face; });
      g.line.forEach((l) => { l.x = g.los - 0.5 + Math.min(1, g.t); });
      if (g.t >= 0.45) startCarry(g.rb, CALLS.run.live);
    } else if (st === "carry") {
      g.t += dt; g.carryT += dt;
      const c = g.carrier;
      // you control the ball carrier: up/down to change lanes, right to burst, left to throttle down
      const vy = (held.up ? -1 : 0) + (held.down ? 1 : 0);
      const pace = held.right ? 1.1 : held.left ? 0.55 : 1;
      c.x += c.speed * pace * Math.min(1, 0.55 + g.carryT * 0.9) * dt;
      let dy = 0;
      if (g.juke > 0) { dy = g.jukeDir * 11 * dt; g.juke -= dt; }
      else if (vy) { dy = vy * 6.2 * dt; g.steerY = null; }
      else if (g.steerY !== null) { const off = g.steerY - c.y; dy = Math.sign(off) * Math.min(Math.abs(off), 6.2 * dt); }
      c.y = clampY(c.y + dy);
      c.face = Math.atan2(dy / Math.max(dt, 1e-3), c.speed * pace);
      g.immune = Math.max(0, g.immune - dt);
      // blockers pick up the nearest defender
      const defenders = [...g.defs, ...g.rush];
      [...g.line, ...g.recv.filter((r) => r !== c)].forEach((b) => {
        const d = defenders.reduce((a, x) => (dist(x, b) < dist(a, b) ? x : a));
        if (dist(d, b) > 1) moveToward(b, d.x, d.y, 4.6 * dt);
      });
      if (c !== g.qb && g.qb) moveToward(g.qb, g.qb.x + 1, g.qb.y, 2 * dt);
      // pursuit: rushers are held at the line for a moment on runs
      const lead = { x: c.x + c.speed * 0.25, y: c.y };
      defenders.forEach((d) => {
        if (reading(d)) {
          if (d.role === "cover") { const p = routePos(d.cover, g.t - 0.5); moveToward(d, p.x + 1.5, p.y, 6 * dt); }
          return;
        }
        moveToward(d, lead.x, lead.y, pursuit(d) * dt);
      });
      if (c.x >= 100) return touchdown();
      if (g.immune <= 0) {
        const tackler = defenders.find((d) => dist(d, c) < TACKLE_R && !(d.role === "rush" && reading(d)));
        if (tackler) {
          const gain = Math.round(c.x) - g.los;
          const text = gain > 0 ? `${c.name} gains ${gain}.` : gain === 0 ? `${c.name} is stopped for no gain.` : `${c.name} is dropped for a loss of ${-gain}.`;
          return endPlay(text, c.x);
        }
      }
    } else if (st === "dead") {
      g.wait -= dt;
      if (g.wait <= 0) { const f = g.after; g.after = null; f(); }
    }

    const touch = g.state === "carry" ? "none" : "pan-y";
    if (fc.style.touchAction !== touch) fc.style.touchAction = touch;
    const focusX = g.state === "carry" ? g.carrier.x - visW() * 0.15 : g.state === "td" ? 100 : g.los;
    g.camX += (camTarget(focusX) - g.camX) * Math.min(1, dt * (g.state === "carry" ? 5 : 2.6));
  }

  /* ---- drawing ---- */
  const X = (x) => (x - g.camX) * S, Y = (y) => (y - Y0) * S;

  function drawField() {
    const vw = visW();
    fx.fillStyle = "#1d5c30"; fx.fillRect(0, 0, FW, FH);
    for (let x = -10; x < 110; x += 5) {
      if (x + 5 < g.camX || x > g.camX + vw) continue;
      fx.fillStyle = x < 0 ? "#0b2265" : x >= 100 ? "#a71930" : (x / 5) % 2 ? "#2c7d41" : "#2a763d";
      fx.fillRect(X(x), 0, 5 * S + 1, FH);
    }
    fx.save();
    fx.textAlign = "center"; fx.textBaseline = "middle";
    fx.fillStyle = "rgba(255,255,255,.92)";
    fx.font = `900 ${Math.round(3.6 * S)}px 'Big Shoulders Display', Impact, sans-serif`;
    [[-5, "NEW YORK", -Math.PI / 2], [105, "GIANTS", Math.PI / 2]].forEach(([x, t, rot]) => {
      fx.save(); fx.translate(X(x), Y(MID)); fx.rotate(rot); fx.fillText(t, 0, 0); fx.restore();
    });
    fx.fillStyle = "rgba(11,34,101,.75)";
    const mw = 7 * S, mh = 4.4 * S;
    fx.beginPath(); fx.roundRect(X(50) - mw / 2, Y(MID) - mh / 2, mw, mh, 6); fx.fill();
    fx.fillStyle = "rgba(255,255,255,.9)";
    fx.font = `900 ${Math.round(3 * S)}px 'Big Shoulders Display', Impact, sans-serif`;
    fx.fillText("NY", X(50), Y(MID) + 2);
    fx.strokeStyle = "rgba(255,255,255,.8)";
    for (let x = 0; x <= 100; x += 5) {
      fx.lineWidth = x % 100 === 0 ? 4 : 2;
      fx.beginPath(); fx.moveTo(X(x), 0); fx.lineTo(X(x), FH); fx.stroke();
    }
    fx.lineWidth = 1.5;
    for (let x = 1; x < 100; x++) {
      if (x % 5 === 0) continue;
      [MID - 3.1, MID + 3.1, Y0 + 0.6, Y0 + SPAN - 0.6].forEach((y) => {
        fx.beginPath(); fx.moveTo(X(x), Y(y) - 0.35 * S); fx.lineTo(X(x), Y(y) + 0.35 * S); fx.stroke();
      });
    }
    fx.fillStyle = "rgba(255,255,255,.85)";
    fx.font = `800 ${Math.round(2.2 * S)}px 'Big Shoulders Display', Impact, sans-serif`;
    for (let x = 10; x <= 90; x += 10) {
      const n = String(x <= 50 ? x : 100 - x);
      fx.fillText(n, X(x), Y(MID + 11));
      fx.save(); fx.translate(X(x), Y(MID - 11)); fx.rotate(Math.PI); fx.fillText(n, 0, 0); fx.restore();
    }
    fx.restore();
  }

  function flag(x, label, bg, fg, top) {
    fx.font = "600 12px 'JetBrains Mono', monospace";
    const w = fx.measureText(label).width + 14;
    fx.fillStyle = bg;
    fx.beginPath(); fx.roundRect(X(x) - w / 2, top, w, 22, 4); fx.fill();
    fx.fillStyle = fg; fx.textAlign = "center"; fx.textBaseline = "middle";
    fx.fillText(label, X(x), top + 11.5);
  }

  function drawLines() {
    if (g.state === "td" || !nextStop()) return;
    fx.lineWidth = 3;
    fx.strokeStyle = "#4da3ff";
    fx.beginPath(); fx.moveTo(X(g.los), 0); fx.lineTo(X(g.los), FH); fx.stroke();
    fx.strokeStyle = "#ffd84a";
    fx.beginPath(); fx.moveTo(X(g.fd), 0); fx.lineTo(X(g.fd), FH); fx.stroke();
    if (g.fd < 100) flag(g.fd, "1ST DOWN", "#ffd84a", "#1a1400", FH - 30);
    const stop = stopLine();
    fx.setLineDash([8, 6]); fx.strokeStyle = "rgba(255,255,255,.85)";
    fx.beginPath(); fx.moveTo(X(stop), 0); fx.lineTo(X(stop), FH); fx.stroke(); fx.setLineDash([]);
    flag(stop, nextStop().td ? "END ZONE" : `NEXT: ${nextStop().short.toUpperCase()}`, "#fff", "#0b2265", 8);
  }

  function drawPlayer(p, team, badge, tag, lit) {
    const px = X(p.x), py = Y(p.y), r = 0.85 * S, a = p.face || 0;
    if (lit) {
      fx.fillStyle = "rgba(255,216,74,.35)";
      fx.beginPath(); fx.arc(px, py, r * 1.7, 0, 7); fx.fill();
    }
    fx.fillStyle = "rgba(0,0,0,.28)";
    fx.beginPath(); fx.ellipse(px + 2, py + r * 0.75, r * 1.1, r * 0.45, 0, 0, 7); fx.fill();
    fx.fillStyle = team.body; fx.strokeStyle = team.trim; fx.lineWidth = 2;
    fx.beginPath(); fx.arc(px, py, r, 0, 7); fx.fill(); fx.stroke();
    const hx = px + Math.cos(a) * r * 0.3, hy = py + Math.sin(a) * r * 0.3;
    fx.fillStyle = team.helm;
    fx.beginPath(); fx.arc(hx, hy, r * 0.58, 0, 7); fx.fill();
    fx.strokeStyle = team.trim; fx.lineWidth = 1.5;
    fx.beginPath(); fx.arc(hx, hy, r * 0.58, a - 0.7, a + 0.7); fx.stroke();
    fx.textAlign = "center"; fx.textBaseline = "middle";
    if (tag) {
      fx.font = "600 10px 'JetBrains Mono', monospace";
      const w = fx.measureText(tag).width + 8;
      fx.fillStyle = "rgba(6,16,42,.8)";
      fx.beginPath(); fx.roundRect(px - w / 2, py + r + 4, w, 15, 3); fx.fill();
      fx.fillStyle = "#fff"; fx.fillText(tag, px, py + r + 12);
    }
    if (badge) {
      fx.fillStyle = "#ffd84a";
      fx.beginPath(); fx.arc(px, py - r * 1.9, 8, 0, 7); fx.fill();
      fx.fillStyle = "#1a1400"; fx.font = "600 11px 'JetBrains Mono', monospace";
      fx.fillText(badge, px, py - r * 1.9 + 0.5);
    }
  }

  function drawFootball(x, y, z, ang) {
    const px = X(x), py = Y(y), lift = z * S * 0.55, k = 1 + z * 0.05;
    fx.fillStyle = `rgba(0,0,0,${0.3 - Math.min(0.2, z * 0.03)})`;
    fx.beginPath(); fx.ellipse(px + 2, py + 3, 0.5 * S, 0.22 * S, 0, 0, 7); fx.fill();
    fx.save(); fx.translate(px, py - lift); fx.rotate(ang);
    fx.fillStyle = "#7b3f1a"; fx.strokeStyle = "#3b1d0b"; fx.lineWidth = 1.2;
    fx.beginPath(); fx.ellipse(0, 0, 0.55 * S * k, 0.32 * S * k, 0, 0, 7); fx.fill(); fx.stroke();
    fx.strokeStyle = "#fff";
    fx.beginPath(); fx.moveTo(-0.22 * S * k, 0); fx.lineTo(0.22 * S * k, 0); fx.stroke();
    fx.restore();
  }

  function drawAim() {
    if (!g.aim) return;
    if (g.state === "carry") {
      // steering guide for the ball carrier
      fx.setLineDash([4, 6]); fx.strokeStyle = "rgba(255,255,255,.5)"; fx.lineWidth = 2;
      fx.beginPath(); fx.moveTo(X(g.carrier.x), Y(g.carrier.y)); fx.lineTo(X(g.carrier.x + 6), Y(g.aim.y)); fx.stroke();
      fx.setLineDash([]);
      return;
    }
    if (g.state !== "live") return;
    const q = g.qb, a = g.aim;
    const d = Math.hypot(a.x - q.x, a.y - q.y), h = Math.min(6, 1 + d * 0.13);
    fx.setLineDash([6, 7]); fx.lineWidth = 2; fx.strokeStyle = "rgba(255,255,255,.75)";
    fx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, x = q.x + (a.x - q.x) * u, y = q.y + (a.y - q.y) * u, z = 4 * h * u * (1 - u);
      const px = X(x), py = Y(y) - z * S * 0.55;
      i ? fx.lineTo(px, py) : fx.moveTo(px, py);
    }
    fx.stroke(); fx.setLineDash([]);
    fx.strokeStyle = "#fff"; fx.lineWidth = 2;
    fx.beginPath(); fx.arc(X(a.x), Y(a.y), CATCH_R * S * 0.6, 0, 7); fx.stroke();
    fx.beginPath(); fx.arc(X(a.x), Y(a.y), 3, 0, 7); fx.fillStyle = "#fff"; fx.fill();
  }

  function draw() {
    if (!FW || !g.qb) return;
    drawField();
    drawLines();
    drawAim();
    const tags = g.state === "pre" || g.state === "live" || g.state === "air";
    const people = [
      ...g.line.map((p) => [p, OFF]), ...g.rush.map((p) => [p, DEF]), ...g.defs.map((p) => [p, DEF]),
      ...g.recv.map((p) => [p, OFF, g.state === "live" ? String(p.key) : null, tags || p === g.carrier ? `${p.num} ${p.name.toUpperCase()}` : null]),
      [g.qb, OFF, null, tags || g.carrier === g.qb ? `${QB.num} ${QB.name.toUpperCase()}` : null],
    ];
    if (g.rb) people.push([g.rb, OFF, null, g.state === "pre" || g.state === "handoff" || g.carrier === g.rb ? `${RB.num} ${RB.name.toUpperCase()}` : null]);
    people.sort((a, b) => a[0].y - b[0].y).forEach(([p, team, badge, tag]) => drawPlayer(p, team, badge, tag, p === g.carrier && g.state === "carry"));
    const holder = g.carrier || (["pre", "live", "handoff"].includes(g.state) ? g.qb : null);
    if (holder) drawFootball(holder.x + Math.cos(holder.face || 0) * 0.6, holder.y + 0.3, 0, (holder.face || 0) + 0.5);
    if (g.ball) {
      const b = g.ball;
      drawFootball(b.x, b.y, b.z, Math.atan2(b.ty - b.fy, b.tx - b.fx) + (g.t - b.t0) * 0.6);
    }
    g.rings.forEach((r) => {
      fx.strokeStyle = `rgba(255,216,74,${1 - r.t / 0.7})`; fx.lineWidth = 3;
      fx.beginPath(); fx.arc(X(r.x), Y(r.y), (1 + r.t * 5) * S, 0, 7); fx.stroke();
    });
  }

  // input
  function toWorld(e) {
    const rect = fc.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / S + g.camX, y: (e.clientY - rect.top) / S + Y0 };
  }
  // Mouse: the runner follows the pointer. Touch: drag to steer, quick tap to juke.
  const held = { up: false, down: false, left: false, right: false };
  const HOLD_KEYS = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
  let press = null;
  fc.addEventListener("pointermove", (e) => {
    g.aim = toWorld(e);
    if (g.state === "carry" && (e.pointerType === "mouse" || press)) g.steerY = clampY(g.aim.y);
  });
  fc.addEventListener("pointerleave", () => { g.aim = null; press = null; });
  fc.addEventListener("pointerdown", (e) => {
    const p = toWorld(e);
    press = { t: performance.now(), x: e.clientX, y: e.clientY };
    if (g.state === "pre") callPlay(g.lastCall);
    else if (g.state === "live") { g.aim = p; throwTo(p.x, p.y); }
    else if (g.state === "carry") g.steerY = clampY(p.y);
    else if (g.state === "td") setPlay(0);
  });
  fc.addEventListener("pointerup", (e) => {
    if (press && g.state === "carry" && performance.now() - press.t < 250 && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 12) juke();
    press = null;
  });
  document.addEventListener("keyup", (e) => { const k = HOLD_KEYS[e.key]; if (k) held[k] = false; });
  addEventListener("blur", () => Object.keys(held).forEach((k) => (held[k] = false)));
  $("#playcall").addEventListener("click", (e) => { const b = e.target.closest("button[data-call]"); if (b) callPlay(b.dataset.call); });
  const CALL_KEYS = { p: "pass", a: "pa", r: "run", s: "screen" };
  function driveKey(e) {
    const k = e.key.toLowerCase();
    if (g.state === "pre" && CALL_KEYS[k]) { callPlay(CALL_KEYS[k]); return true; }
    if (e.code === "Space") {
      e.preventDefault();
      if (g.state === "pre") callPlay(g.lastCall);
      else if (g.state === "carry") juke();
      else if (g.state === "td") setPlay(0);
      return true;
    }
    if (/^[1-5]$/.test(e.key)) { throwToReceiver(+e.key); return true; }
    if (g.state === "carry" && HOLD_KEYS[e.key]) {
      e.preventDefault();
      held[HOLD_KEYS[e.key]] = true;
      return true;
    }
    return false;
  }

  // The job buttons only change which job you're reading about; the drive itself has to be earned.
  tabs.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) showPlayCard(+b.dataset.i); });

  let fieldVisible = true, lastT = performance.now();
  new IntersectionObserver((en) => { fieldVisible = en[0].isIntersecting; }).observe(fc);
  new ResizeObserver(() => { sizeField(); g.camX = camTarget(g.state === "td" ? 100 : g.los); draw(); }).observe(fc);
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (fieldVisible) { update(dt); draw(); }
    requestAnimationFrame(frame);
  }
  sizeField();
  setPlay(0, true);
  if (document.fonts) document.fonts.ready.then(draw);
  requestAnimationFrame(frame);

  function inView(el) {
    const r = el.getBoundingClientRect();
    return r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.4;
  }

  /* ---------------- skills board ---------------- */
  const skills = [
    ["Python", "Languages", "I use it for most of my work, including dashboards at Astoria, reconciliation tools at Susquehanna, and data jobs at Truthifi."],
    ["SQL", "Languages", "I used it to pull and check trade data for the daily P&L work at Susquehanna."],
    ["VBA", "Languages", "I automated the weekly ETF report emails at Astoria and Excel tasks at Susquehanna with it."],
    ["Java", "Languages", "I learned the fundamentals of programming with it in school."],
    ["R", "Languages", "I used it in my statistics and probability coursework."],
    ["Pandas", "Data & machine learning", "I use it to clean and shape data in almost every project, from IMC Prosperity to backtests."],
    ["NumPy", "Data & machine learning", "I use it for simulations and math, like the Monte Carlo option pricing in my FE 620 project."],
    ["Scikit-learn", "Data & machine learning", "I used it to cluster stocks for my first trading bot and in my machine learning coursework."],
    ["TensorFlow", "Data & machine learning", "I built neural networks with it in my machine learning coursework at Stevens."],
    ["Keras", "Data & machine learning", "I used it to build and train models quickly in class projects."],
    ["BeautifulSoup", "Data & machine learning", "I use it to scrape web pages when the data I need isn't available in a clean feed."],
    ["Requests", "Data & machine learning", "I used it for the uptime monitor I built at Truthifi, which sends requests to the team's app."],
    ["Git / GitHub", "Tools", "Every project I build lives on GitHub, including this site."],
    ["MongoDB", "Tools", "It's the database behind the ingestion jobs I wrote at Truthifi."],
    ["Bloomberg Terminal", "Tools", "I used it for research at the Stevens Student Managed Investment Fund."],
    ["Claude Code", "Tools", "I used it to speed up desk processes at CTC, and it helped me build this site."],
  ];
  const groupsEl = $("#skillGroups");
  [...new Set(skills.map((k) => k[1]))].forEach((g) => {
    const chips = skills
      .map((k, i) => (k[1] === g ? `<button class="skill" data-i="${i}">${k[0]}</button>` : ""))
      .join("");
    groupsEl.insertAdjacentHTML("beforeend", `<div class="skill-group"><h3>${g}</h3><div class="chips">${chips}</div></div>`);
  });
  const chipFor = (i) => groupsEl.querySelector(`.skill[data-i="${i}"]`);
  function showSkill(i, fromShot) {
    const [n, g, d] = skills[i];
    groupsEl.querySelectorAll(".skill").forEach((b) => b.classList.toggle("sel", +b.dataset.i === i));
    $("#skillDetail").innerHTML = `<span class="lbl">${fromShot ? "Bucket · " : ""}${g}</span><h4>${n}</h4><p>${d}</p>`;
    if (fromShot) {
      const c = chipFor(i);
      c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop");
    }
  }
  groupsEl.addEventListener("click", (e) => { const b = e.target.closest(".skill"); if (b) showSkill(+b.dataset.i, false); });
  showSkill(0, false);

  /* ---------------- Comeback at the Garden: Knicks vs. 76ers ----------------
     Fourth quarter, down 14. Every Knicks bucket opens up the next reveal (a group of skills).
     Philly answers after each trip, but only enough to keep it close, so the eighth bucket is
     always a go-ahead three at the horn. */
  // 2026-27 Knicks rotation (Basketball-Reference / KnicksOnline rosters)
  const KNICKS = [
    { name: "Brunson", num: "11" }, { name: "Towns", num: "32" }, { name: "Anunoby", num: "8" },
    { name: "Bridges", num: "25" }, { name: "Hart", num: "3" }, { name: "McBride", num: "2" },
    { name: "Clarkson", num: "00" }, { name: "Alvarado", num: "5" },
  ];
  const SIXERS = ["Maxey", "Embiid", "George", "Edgecombe"];
  const SPOTS = [
    { x: 440, pts: 2, where: "the restricted area", width: 0.24 },
    { x: 345, pts: 2, where: "the elbow", width: 0.19 },
    { x: 285, pts: 2, where: "mid-range", width: 0.17 },
    { x: 205, pts: 3, where: "the wing", width: 0.14 },
    { x: 175, pts: 3, where: "the top of the key", width: 0.13 },
    { x: 120, pts: 3, where: "way downtown", width: 0.11 },
    { x: 62, pts: 3, where: "the logo", width: 0.09 },
  ];
  const TOP_OF_KEY = SPOTS[4];
  // each bucket opens one of these, in order (indexes into skills)
  const REVEALS = [
    { tab: "Python", title: "Python", items: [0] },
    { tab: "SQL & VBA", title: "SQL and VBA", items: [1, 2] },
    { tab: "Java & R", title: "Java and R", items: [3, 4] },
    { tab: "Pandas & NumPy", title: "Pandas and NumPy", items: [5, 6] },
    { tab: "Machine learning", title: "Machine learning", items: [7, 8, 9] },
    { tab: "Web data", title: "Web data", items: [10, 11, 13] },
    { tab: "Bloomberg & Git", title: "Bloomberg and Git", items: [14, 12] },
    { tab: "Claude Code", title: "Claude Code", items: [15] },
  ];
  const START = { nyk: 95, phi: 109, clock: 180 };
  // how far behind the Knicks should be after Philly's answer, by buckets made so far
  const TARGET = [14, 12, 10, 8, 7, 5, 4, 2];
  const FLOOR = 336;
  const RIM = { x: 520, y: 150, r: 24 };
  const hc = $("#hoop"), hx = hc.getContext("2d");
  const W = 640, H = 380;

  const sg = {
    state: "ready", nyk: START.nyk, phi: START.phi, clock: START.clock, streak: 0, makes: 0, opened: 0,
    shooter: KNICKS[0], spot: SPOTS[1], zone: [0.4, 0.6], charging: false, power: 0, chargeT: 0,
    shot: null, jump: 0, crowd: 0, embers: [], banner: 0, pbp: [],
  };
  const deficit = () => sg.phi - sg.nyk;
  const finalShot = () => sg.state === "playing" && sg.opened === REVEALS.length - 1 && deficit() >= 1 && deficit() <= 2;

  const rosterEl = $("#roster");
  rosterEl.innerHTML = KNICKS.map((k, i) => `<button data-i="${i}"${i ? "" : ' class="sel"'}><b>#${k.num}</b>${k.name}</button>`).join("");
  rosterEl.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || sg.shot || sg.charging) return;
    sg.shooter = KNICKS[+b.dataset.i];
    rosterEl.querySelectorAll("button").forEach((x) => x.classList.toggle("sel", x === b));
    if (sg.state !== "over") call(`${sg.shooter.name} checks in. ${sg.state === "ready" ? "Press and hold to start the comeback." : "Knicks ball."}`);
  });

  /* ---- reveal tabs: locked until the bucket that opens them ---- */
  const revealTabs = $("#revealTabs"), revealCard = $("#revealCard");
  REVEALS.forEach((r, i) => revealTabs.insertAdjacentHTML("beforeend", `<button data-i="${i}" disabled>${i + 1}. ${r.tab}</button>`));
  revealTabs.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && !b.disabled) showReveal(+b.dataset.i); });
  function showReveal(i) {
    revealTabs.querySelectorAll("button").forEach((b, j) => {
      b.disabled = j >= sg.opened;
      b.setAttribute("aria-pressed", j === i);
      b.textContent = j < sg.opened ? `${j + 1}. ${REVEALS[j].tab}` : `${j + 1}. ?`;
    });
    if (i < 0) {
      revealCard.classList.remove("final");
      revealCard.innerHTML = `<p class="pbp">Q4 · 3:00 · Knicks 95, 76ers 109</p><h3>Eight buckets to go</h3><p class="locked">Each Knicks bucket opens one more of the tools I use, in order, with where I've used it. The last one wins the game.</p>`;
      return;
    }
    const r = REVEALS[i], last = i === REVEALS.length - 1;
    revealCard.classList.toggle("final", last);
    revealCard.innerHTML = `
      <p class="pbp">${sg.pbp[i] || ""}</p>
      <h3>${r.title}</h3>
      <ul>${r.items.map((k) => `<li><b>${skills[k][0]}</b>: ${skills[k][2]}</li>`).join("")}</ul>`;
  }

  function call(text, hot) { const c = $("#call"); c.textContent = text; c.classList.toggle("hot", !!hot); }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const onFire = () => sg.streak >= 4;
  const fmtClock = (t) => (t < 10 ? t.toFixed(1) : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`);
  const scoreLine = () => (deficit() > 0 ? `76ers by ${deficit()}` : deficit() < 0 ? `Knicks by ${-deficit()}` : "All tied");

  function newSpot() {
    if (finalShot()) {
      sg.spot = TOP_OF_KEY;
    } else {
      const pool = Math.random() < 0.12 ? SPOTS : SPOTS.slice(0, -1); // the logo shows up now and then
      let s; do { s = pick(pool); } while (s === sg.spot);
      sg.spot = s;
    }
    const width = sg.spot.width + (onFire() ? 0.03 : 0) + (finalShot() ? 0.03 : 0);
    const lo = 0.22 + Math.random() * (0.72 - width);
    sg.zone = [lo, lo + width];
    const z = $("#zone");
    z.style.left = lo * 100 + "%"; z.style.width = width * 100 + "%";
  }

  function resetGame() {
    Object.assign(sg, { state: "ready", nyk: START.nyk, phi: START.phi, clock: START.clock, streak: 0, makes: 0, opened: 0, shot: null, embers: [], banner: 0, pbp: [] });
    $("#shootBtn").textContent = "Hold to shoot";
    updateBoard();
    newSpot();
    showReveal(-1);
    call(`${sg.shooter.name} brings it up, down 14. Press and hold to start the comeback.`);
  }
  function updateBoard() {
    $("#score").textContent = sg.nyk;
    $("#phi").textContent = sg.phi;
    $("#clock").textContent = fmtClock(sg.clock);
    $("#streak").textContent = sg.streak;
  }

  function startCharge() {
    if (sg.state === "over") { resetGame(); return; }
    if (sg.shot || sg.charging) return;
    if (sg.state === "ready") sg.state = "playing";
    sg.charging = true; sg.chargeT = performance.now();
  }
  function release() {
    if (!sg.charging) return;
    sg.charging = false;
    shoot(sg.power);
  }

  function shoot(pw) {
    const [lo, hi] = sg.zone;
    const make = pw >= lo && pw <= hi;
    const mid = (lo + hi) / 2;
    const miss = make ? 0 : Math.max(-80, Math.min(28, (pw - mid) * 260)); // short or long
    const sx = sg.spot.x + 8, sy = FLOOR - 112;
    sg.shot = { make, miss, sx, sy, tx: RIM.x + miss, ty: RIM.y - 4, t: 0, dur: 0.75 + (RIM.x - sx) * 0.0014, arcH: 120 + (RIM.x - sx) * 0.16, phase: "up", x: sx, y: sy, rot: 0, fire: onFire(), last: finalShot() };
  }

  // Philly's trip the other way: scores just enough to land on the target margin
  function sixersAnswer(made) {
    if (sg.opened >= REVEALS.length - 1 && deficit() >= 1 && deficit() <= 2) return made ? "Philly can't answer." : "";
    const want = made ? TARGET[sg.opened] : Math.min(deficit() + 2, TARGET[sg.opened] + 3);
    const pts = Math.max(0, Math.min(3, want - deficit()));
    sg.phi += pts;
    const p = pick(SIXERS);
    return [
      pick([`${p} misses the pull-up.`, `${p} is stripped by Anunoby.`, `${p}'s three rims out.`, `Shot clock violation on Philly.`]),
      `${p} splits a pair at the line.`,
      pick([`${p} answers at the rim.`, `${p} hits the turnaround.`, `${p} scores in the paint.`]),
      pick([`${p} answers with a three.`, `${p} hits from deep.`]),
    ][pts];
  }

  function finishShot() {
    const s = sg.shot, n = sg.shooter.name, where = sg.spot.where;
    sg.shot = null;
    if (s.make) {
      const pts = sg.spot.pts + (s.fire ? 1 : 0);
      sg.nyk += pts; sg.streak++; sg.makes++;
      sg.crowd = 1;
      if (s.last) return win(pts);
      const opens = sg.opened < REVEALS.length - 1;
      const play = `${n} from ${where}, +${pts}.`;
      sg.clock = Math.max(12, sg.clock - 20);
      if (opens) { sg.pbp[sg.opened] = `Q4 · ${fmtClock(sg.clock)} · ${play} Knicks ${sg.nyk}, 76ers ${sg.phi}`; sg.opened++; showReveal(sg.opened - 1); }
      const answer = sixersAnswer(true);
      if (sg.streak === 4) { sg.banner = 2; call(`${n} is on fire! Bonus point on every make. ${answer} ${scoreLine()}.`, true); }
      else call(`${pick([`${n} from ${where}... got it!`, `${n} rises up from ${where}. Bang!`, `${n} knocks it down from ${where}.`, `${n} from ${where}... nothing but net.`])} ${answer} ${scoreLine()}.`, s.fire);
    } else {
      const coolOff = sg.streak >= 4;
      sg.streak = 0;
      if (s.last) {
        sg.clock = Math.max(0.8, sg.clock - 1.4);
        call(`${n} misses, but Hart grabs the board. Timeout Knicks, ${fmtClock(sg.clock)} left.`);
      } else {
        sg.clock = Math.max(12, sg.clock - 14);
        const miss = coolOff ? `${n} cools off.` : s.miss < -10 ? `${n} from ${where}... short.` : s.miss > 10 ? `${n} from ${where}... off the back iron.` : `${n} from ${where}... in and out.`;
        call(`${miss} ${sixersAnswer(false)} ${scoreLine()}.`);
      }
    }
    if (finalShot() && sg.clock > 4) { sg.clock = 4; call(`Knicks down ${deficit()}, 4.0 seconds left. Timeout. ${sg.shooter.name} for the win from the top of the key.`, true); }
    updateBoard();
    newSpot();
  }

  function win(pts) {
    sg.clock = 0;
    sg.pbp[sg.opened] = `Final · ${sg.shooter.name} from ${sg.spot.where} at the horn, +${pts}. Knicks ${sg.nyk}, 76ers ${sg.phi}`;
    sg.opened = REVEALS.length;
    showReveal(REVEALS.length - 1);
    sg.state = "over"; sg.charging = false; sg.banner = 3;
    $("#meterFill").style.width = "0";
    updateBoard();
    confetti(["#f58426", "#006bb6", "#fff"]);
    call(`${sg.shooter.name}... BANG! Knicks win ${sg.nyk}–${sg.phi}. Press the button to run it back.`, true);
    $("#shootBtn").textContent = "Run it back";
  }

  function updateShootout(dt) {
    if (sg.charging) {
      const ph = ((performance.now() - sg.chargeT) / 1050) % 2;
      sg.power = ph < 1 ? ph : 2 - ph;
      $("#meterFill").style.width = sg.power * 100 + "%";
    }
    const s = sg.shot;
    sg.jump = s && s.t < 0.4 ? Math.sin((Math.PI * s.t) / 0.4) * 26 : Math.max(0, sg.jump - dt * 120);
    if (s) {
      s.t += dt;
      if (s.phase === "up") {
        const u = Math.min(1, s.t / s.dur);
        s.x = s.sx + (s.tx - s.sx) * u;
        s.y = s.sy + (s.ty - s.sy) * u - 4 * s.arcH * u * (1 - u);
        s.rot = u * 9;
        if (u >= 1) { s.phase = "down"; s.t2 = 0; s.x0 = s.x; s.y0 = s.y; s.vx = s.make ? 0 : (s.miss < 0 ? -140 : 160); }
      } else {
        s.t2 += dt;
        s.x = s.x0 + s.vx * s.t2;
        s.y = s.make ? s.y0 + 60 * s.t2 + 900 * s.t2 * s.t2 : s.y0 - 190 * s.t2 + 700 * s.t2 * s.t2;
        s.rot += dt * 6;
        if (s.y > FLOOR - 10 || s.t2 > 1.2) { $("#meterFill").style.width = "0"; finishShot(); }
      }
      if (s && s.fire) sg.embers.push({ x: s.x, y: s.y, life: 0.5 });
    }
    sg.embers.forEach((e) => { e.life -= dt; e.y -= 30 * dt; });
    sg.embers = sg.embers.filter((e) => e.life > 0);
    sg.crowd = sg.state === "over" ? 1 : Math.max(0, sg.crowd - dt * 0.9);
    sg.banner = Math.max(0, sg.banner - dt);
  }
  function drawShootout(now) {
    hx.clearRect(0, 0, W, H);
    // stands: the crowd stands up on every make
    const grd = hx.createLinearGradient(0, 0, 0, 230);
    grd.addColorStop(0, "#001a3a"); grd.addColorStop(1, "#003f7a");
    hx.fillStyle = grd; hx.fillRect(0, 0, W, 230);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 41; c++) {
      const hop = sg.crowd * Math.abs(Math.sin(now / 90 + c * 0.7 + r)) * 7;
      hx.fillStyle = (c + r) % 5 === 0 ? "rgba(245,132,38,.35)" : "rgba(255,255,255,.08)";
      hx.beginPath(); hx.arc(6 + c * 16 + (r % 2) * 8, 16 + r * 16 - hop, 4.5, 0, 7); hx.fill();
    }
    hx.fillStyle = "rgba(245,132,38,.92)"; hx.fillRect(0, 208, W, 22);
    hx.fillStyle = "#002850";
    hx.font = "900 16px 'Big Shoulders Display', Impact, sans-serif";
    hx.textAlign = "left"; hx.textBaseline = "alphabetic";
    for (let x = 12; x < W; x += 180) hx.fillText("NEW YORK  ·  THE GARDEN", x, 225);
    // floor
    hx.fillStyle = "#c98a4b"; hx.fillRect(0, 230, W, H - 230);
    hx.strokeStyle = "rgba(90,50,20,.25)"; hx.lineWidth = 1;
    for (let y = 240; y < H; y += 14) { hx.beginPath(); hx.moveTo(0, y); hx.lineTo(W, y); hx.stroke(); }
    hx.fillStyle = "rgba(0,107,182,.7)";
    hx.beginPath(); hx.moveTo(430, 230); hx.lineTo(W, 230); hx.lineTo(W, H); hx.lineTo(380, H); hx.closePath(); hx.fill();
    hx.strokeStyle = "#fff"; hx.lineWidth = 3;
    hx.beginPath(); hx.moveTo(430, 230); hx.lineTo(380, H); hx.stroke();
    // three-point line
    hx.beginPath(); hx.moveTo(240, 230); hx.lineTo(225, H); hx.stroke();
    // hoop
    hx.fillStyle = "#333"; hx.fillRect(598, 120, 10, 210);
    hx.fillStyle = "rgba(255,255,255,.88)"; hx.fillRect(552, 70, 8, 110);
    hx.strokeStyle = css("--knicks"); hx.lineWidth = 2; hx.strokeRect(552, 120, 8, 36);
    hx.fillStyle = "#555"; hx.fillRect(544, RIM.y - 2, 12, 4);
    const swish = sg.shot && sg.shot.make && sg.shot.phase === "down" ? Math.min(1, sg.shot.t2 * 4) : 0;
    hx.strokeStyle = "rgba(255,255,255,.85)"; hx.lineWidth = 1.2;
    for (let i = 0; i <= 6; i++) {
      const x0 = RIM.x - RIM.r + (i * 2 * RIM.r) / 6;
      const x1 = RIM.x - RIM.r * 0.55 + (i * 1.1 * RIM.r) / 6;
      hx.beginPath(); hx.moveTo(x0, RIM.y); hx.lineTo(x1, RIM.y + 42 + swish * 8); hx.stroke();
    }
    for (let k = 1; k <= 3; k++) {
      const yy = RIM.y + k * 13 + swish * k * 2.5, sh = RIM.r * (1 - k * 0.14);
      hx.beginPath(); hx.moveTo(RIM.x - sh, yy); hx.lineTo(RIM.x + sh, yy); hx.stroke();
    }
    // a Sixer closes out: Embiid protects the paint, Maxey chases shooters
    const guard = sg.spot.x > 300 ? { num: "21", name: "Embiid" } : { num: "0", name: "Maxey" };
    const contest = sg.shot && sg.shot.t < 0.5 ? Math.sin((Math.PI * sg.shot.t) / 0.5) * 16 : 0;
    if (sg.state !== "over") drawShooter(sg.spot.x + 46, contest, !!sg.shot || sg.charging, { ...guard, body: "#ed174c", trim: "#006bb6" });
    drawShooter(sg.spot.x, sg.jump, !!sg.shot || sg.charging || sg.state === "over");
    sg.embers.forEach((e) => {
      hx.fillStyle = `rgba(255,${120 + Math.round(e.life * 200)},40,${e.life * 1.6})`;
      hx.beginPath(); hx.arc(e.x + (Math.random() - 0.5) * 6, e.y, 3 + e.life * 8, 0, 7); hx.fill();
    });
    const b = sg.shot;
    if (b) drawBall(b.x, b.y, b.rot);
    else drawBall(sg.spot.x + 8, FLOOR - 112 - sg.jump - (sg.charging ? 4 : 0), 0);
    // rim front
    hx.strokeStyle = css("--knicks"); hx.lineWidth = 4;
    hx.beginPath(); hx.moveTo(RIM.x - RIM.r, RIM.y); hx.lineTo(RIM.x + RIM.r, RIM.y); hx.stroke();
    // spot label
    hx.font = "600 11px 'JetBrains Mono', monospace"; hx.textAlign = "center";
    hx.fillStyle = "rgba(255,255,255,.9)";
    hx.fillText(`${sg.spot.where.toUpperCase()} · ${sg.spot.pts} PTS`, sg.spot.x, H - 10);
    // on-fire banner
    if (sg.state === "over" || onFire() || sg.banner > 0) {
      hx.fillStyle = "rgba(0,0,0,.6)";
      hx.beginPath(); hx.roundRect(W / 2 - 80, 60, 160, 34, 6); hx.fill();
      hx.fillStyle = "#ff8a1e";
      hx.font = "900 24px 'Big Shoulders Display', Impact, sans-serif";
      hx.fillText(sg.state === "over" ? "KNICKS WIN" : "ON FIRE", W / 2, 86);
    }
    hx.textAlign = "left";
  }

  function drawShooter(x, j, armsUp, p) {
    const kit = p || { ...sg.shooter, body: "#006bb6", trim: css("--knicks") };
    const top = FLOOR - 104 - j;
    hx.fillStyle = "rgba(0,0,0,.25)";
    hx.beginPath(); hx.ellipse(x, FLOOR + 4, 22, 5, 0, 0, 7); hx.fill();
    hx.strokeStyle = "#1b1b1b"; hx.lineWidth = 6; hx.lineCap = "round";
    hx.beginPath(); hx.moveTo(x - 5, top + 66); hx.lineTo(x - 7, FLOOR - j); hx.moveTo(x + 5, top + 66); hx.lineTo(x + 8, FLOOR - j); hx.stroke();
    hx.fillStyle = kit.body;
    hx.fillRect(x - 12, top + 50, 24, 18);
    hx.fillStyle = kit.trim; hx.fillRect(x - 12, top + 50, 3, 18); hx.fillRect(x + 9, top + 50, 3, 18);
    hx.fillStyle = kit.body;
    hx.beginPath(); hx.roundRect(x - 13, top + 16, 26, 36, 5); hx.fill();
    hx.strokeStyle = kit.trim; hx.lineWidth = 2; hx.stroke();
    hx.fillStyle = "#fff"; hx.textAlign = "center";
    hx.font = "900 17px 'Big Shoulders Display', Impact, sans-serif";
    hx.fillText(kit.num, x, top + 42);
    hx.strokeStyle = "#1b1b1b"; hx.lineWidth = 5;
    hx.beginPath();
    if (armsUp) { hx.moveTo(x - 11, top + 22); hx.lineTo(x + 2, top - 4); hx.moveTo(x + 11, top + 22); hx.lineTo(x + 8, top - 6); }
    else { hx.moveTo(x - 12, top + 22); hx.lineTo(x - 12, top + 46); hx.moveTo(x + 12, top + 22); hx.lineTo(x + 10, top + 6); }
    hx.stroke();
    hx.fillStyle = "#1b1b1b";
    hx.beginPath(); hx.arc(x, top + 6, 9, 0, 7); hx.fill();
    hx.font = "600 10px 'JetBrains Mono', monospace"; hx.fillStyle = "#fff";
    hx.fillText(kit.name.toUpperCase(), x, p ? FLOOR + 22 : top - 22);
    hx.lineCap = "butt"; hx.textAlign = "left";
  }
  function drawBall(x, y, rot) {
    hx.save(); hx.translate(x, y); hx.rotate(rot);
    hx.fillStyle = "#e8742a"; hx.beginPath(); hx.arc(0, 0, 12, 0, 7); hx.fill();
    hx.strokeStyle = "#3a1a06"; hx.lineWidth = 1.4;
    hx.beginPath(); hx.arc(0, 0, 12, 0, 7); hx.stroke();
    hx.beginPath(); hx.moveTo(-12, 0); hx.lineTo(12, 0); hx.stroke();
    hx.beginPath(); hx.moveTo(0, -12); hx.lineTo(0, 12); hx.stroke();
    hx.beginPath(); hx.arc(-17, 0, 12, -0.75, 0.75); hx.stroke();
    hx.beginPath(); hx.arc(17, 0, 12, Math.PI - 0.75, Math.PI + 0.75); hx.stroke();
    hx.restore();
  }

  const sb = $("#shootBtn");
  sb.addEventListener("pointerdown", (e) => { e.preventDefault(); startCharge(); });
  sb.addEventListener("pointerup", release);
  sb.addEventListener("pointerleave", release);
  hc.addEventListener("pointerdown", (e) => { e.preventDefault(); startCharge(); });
  hc.addEventListener("pointerup", release);
  hc.addEventListener("pointerleave", release);

  let courtVisible = true, courtLast = performance.now();
  new IntersectionObserver((en) => { courtVisible = en[0].isIntersecting; }).observe(hc);
  function courtFrame(now) {
    const dt = Math.min(0.05, (now - courtLast) / 1000);
    courtLast = now;
    if (courtVisible) { updateShootout(dt); drawShootout(now); }
    requestAnimationFrame(courtFrame);
  }
  resetGame();
  requestAnimationFrame(courtFrame);

  /* ---------------- huddle: sends the message to my inbox ---------------- */
  const esc = (v) => v.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  $("#playsheet").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const topic = form.querySelector("input[name=play]:checked").value;
    const name = $("#hName").value.trim();
    const from = $("#hEmail").value.trim();
    const message = $("#hMsg").value.trim();
    const f = $("#fillMsg");
    const btn = $("#hSend");
    const show = (html, err) => { f.hidden = false; f.classList.toggle("err", !!err); f.innerHTML = html; };

    if (!FORM_KEY) {
      show(`The contact form isn't connected yet. Please check back soon, or find me on <a href="https://github.com/sparikh099" target="_blank" rel="noopener">GitHub ↗</a>.`, true);
      return;
    }
    btn.disabled = true;
    btn.textContent = "Sending...";
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: FORM_KEY,
          subject: `Website message: ${topic}`,
          from_name: "Personal website",
          replyto: from,
          name, email: from, topic, message,
          botcheck: $("#hBot").checked,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Send failed");
      show(`Thanks, ${esc(name)}. Your message is on its way, and I'll reply to <b>${esc(from)}</b>.`);
      form.reset();
      toast("Message sent");
    } catch (err) {
      show(`The message didn't go through. Check your connection and try again in a moment.`, true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Break the huddle";
    }
  });

  /* ---------------- confetti ---------------- */
  const cf = $("#confetti"), cx = cf.getContext("2d");
  let parts = [], cfRun = false;
  function confetti(colors) {
    if (reduceMotion) return;
    cf.width = innerWidth; cf.height = innerHeight;
    for (let i = 0; i < 120; i++) {
      parts.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.6,
        vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 18 - 6,
        r: 4 + Math.random() * 6, c: colors[i % colors.length], life: 0,
      });
    }
    if (!cfRun) { cfRun = true; requestAnimationFrame(cfLoop); }
  }
  function cfLoop() {
    cx.clearRect(0, 0, cf.width, cf.height);
    parts.forEach((q) => {
      q.vy += 0.45; q.x += q.vx; q.y += q.vy; q.vx *= 0.99; q.life++;
      cx.fillStyle = q.c; cx.fillRect(q.x, q.y, q.r, q.r * 1.6);
    });
    parts = parts.filter((q) => q.y < cf.height + 40 && q.life < 300);
    if (parts.length) requestAnimationFrame(cfLoop);
    else { cfRun = false; cx.clearRect(0, 0, cf.width, cf.height); }
  }

  /* ---------------- command line: quick navigation ---------------- */
  const term = $("#term"), out = $("#termOut"), inp = $("#termInput");
  const go = (id) => { closeTerm(); document.getElementById(id).scrollIntoView({ behavior: "smooth" }); };
  const cmds = {
    help: () => "about, experience, projects, skills, contact, github, knicks, giants, bayern, pizza, clear, exit",
    about: () => { go("card"); return "Heading to the player card."; },
    experience: () => { go("drive"); return "Taking the field."; },
    projects: () => { go("film"); return "Opening the film room."; },
    skills: () => { go("court"); return "Lacing up."; },
    contact: () => { go("huddle"); return "Heading to the contact form."; },
    github: () => { window.open("https://github.com/sparikh099", "_blank"); return "github.com/sparikh099"; },
    knicks: () => { confetti(["#f58426", "#006bb6"]); return "Let's go Knicks."; },
    giants: () => { confetti(["#c8102e", "#0b2265", "#fff"]); return "Go Big Blue."; },
    bayern: () => { confetti(["#dc052d", "#0066b2", "#fff"]); return "Mia san mia."; },
    pizza: () => "Plain slice. Fold it.",
    clear: () => { out.innerHTML = ""; return null; },
    exit: () => { closeTerm(); return null; },
  };
  cmds.exp = cmds.experience;
  function print(text, cls) { const d = document.createElement("div"); if (cls) d.className = cls; d.textContent = text; out.appendChild(d); out.scrollTop = out.scrollHeight; }
  function openTerm() {
    term.hidden = false;
    if (!out.childElementCount) print("Type a section name to jump there, or type 'help' for the full list.");
    setTimeout(() => inp.focus(), 0);
  }
  function closeTerm() { term.hidden = true; }
  $("#termOpen").addEventListener("click", openTerm);
  $("#termClose").addEventListener("click", closeTerm);
  term.addEventListener("click", (e) => { if (e.target === term) closeTerm(); });
  $("#termForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const c = inp.value.trim().toLowerCase();
    inp.value = "";
    if (!c) return;
    print("> " + c, "cmd");
    const fn = cmds[c];
    const r = fn ? fn() : `Unknown command: "${c}". Type 'help' to see the options.`;
    if (r) print(r);
  });

  /* ---------------- keyboard ---------------- */
  const konami = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let kpos = 0;
  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    kpos = e.key === konami[kpos] ? kpos + 1 : e.key === konami[0] ? 1 : 0;
    if (kpos === konami.length) { kpos = 0; confetti(["#f58426", "#006bb6", "#c8102e", "#fff"]); toast("Knicks in 5. Giants in the playoffs."); }

    if (e.key === "Escape" && !term.hidden) return closeTerm();
    if (typing) return;
    if (e.key === "/") { e.preventDefault(); openTerm(); return; }
    if (!term.hidden) return;
    if (inView($("#drive")) && driveKey(e)) return;
    if (e.code === "Space" && inView($("#court"))) { e.preventDefault(); if (!e.repeat) startCharge(); }
  });
  document.addEventListener("keyup", (e) => { if (e.code === "Space") release(); });
})();
