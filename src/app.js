/* ==========================================================================
   MISSION ARCHITECT — user interface
   ========================================================================== */
(() => {
  const G = GAME, V = VIS;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (x, n = 0) => (Math.round(x * Math.pow(10, n)) / Math.pow(10, n)).toLocaleString('en-US', { maximumFractionDigits: n });
  const money = x => '$' + fmt(x, x < 10 ? 1 : 0) + 'M';

  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  const STEPS = [
    { id: 'mission', name: 'Mission', role: 'director', icon: '🎯' },
    { id: 'orbit', name: 'Orbit', role: 'flightops', icon: '🪐' },
    { id: 'payload', name: 'Instruments', role: 'science', icon: '🔬' },
    { id: 'spacecraft', name: 'Spacecraft', role: 'engineer', icon: '🛰️' },
    { id: 'comms', name: 'Comms', role: 'flightops', icon: '📡' },
    { id: 'launch', name: 'Launch', role: 'director', icon: '🚀' },
    { id: 'review', name: 'Design Review', role: null, icon: '✅' },
  ];

  const S = {
    screen: 'home', nPlayers: 1, players: ['Player 1', 'Player 2', 'Player 3', 'Player 4'], team: 'Team Apollo',
    difficulty: 'engineer', design: null, step: 'mission', signoff: {}, override: false,
    sim: null, timer: null, speed: 1, paused: false, votes: {}, lastResult: null, modal: null, attempts: 0, eventResult: null,
  };

  // ---------- helpers ----------
  const ownerOf = role => G.ROLE_ORDER.indexOf(role) % S.nPlayers;
  const playerName = i => S.players[i] || `Player ${i + 1}`;
  const rolesOf = i => G.ROLE_ORDER.filter(r => ownerOf(r) === i);
  const roleChip = role => { const R = G.ROLES[role]; return `<span class="rolechip" style="--rc:${R.color}">${R.icon} ${R.name}</span>`; };
  const designKey = () => JSON.stringify(S.design);
  const hints = () => S.difficulty === 'cadet';

  function setDesign(field, value) {
    S.design[field] = value;
    S.signoff = {};
    S.override = false;
    render();
  }

  // ======================================================================
  //  RENDER ROOT
  // ======================================================================
  function render() {
    const app = $('#app');
    const scroll = window.scrollY;
    const mainScroll = $('.main') ? $('.main').scrollTop : 0;
    let html = '';
    switch (S.screen) {
      case 'home': html = renderHome(); break;
      case 'setup': html = renderSetup(); break;
      case 'scenario': html = renderScenario(); break;
      case 'design': html = renderDesign(); break;
      case 'sim': html = renderSim(); break;
      case 'report': html = renderReport(); break;
    }
    app.innerHTML = html + renderModal();
    if (S.screen === 'design' && S._keepScroll) { window.scrollTo(0, scroll); if ($('.main')) $('.main').scrollTop = mainScroll; }
    S._keepScroll = true;
    if (S.screen === 'sim') updateSimLive();
  }
  function go(screen) { S.screen = screen; S._keepScroll = false; window.scrollTo(0, 0); render(); }

  // ======================================================================
  //  HOME
  // ======================================================================
  function renderHome() {
    const lb = store.get('ma_leaderboard', []);
    return `<div class="home">
      <div class="hero">
        <div class="hero-text">
          <div class="kicker">NASA Space Apps Challenge 2026 · Space Mission Design Game</div>
          <h1>Mission<br><span>Architect</span></h1>
          <p class="lead">Design a real space mission from idea to end-of-life. Pick a science goal, build the spacecraft, choose the orbit and rocket — then launch it and live with every trade-off you made.</p>
          <div class="cta">
            <button class="btn primary big" data-a="newgame">🚀 New mission</button>
            <button class="btn ghost big" data-a="modal" data-v="howto">How to play</button>
          </div>
          <div class="cta small">
            <button class="btn link" data-a="modal" data-v="handbook">📘 Mission Handbook</button>
            <button class="btn link" data-a="modal" data-v="leaderboard">🏆 Leaderboard${lb.length ? ` (${lb.length})` : ''}</button>
            <button class="btn link" data-a="modal" data-v="load">📥 Load a design code</button>
          </div>
        </div>
        <div class="hero-art">${V.craft({ bus: 'medium', power: 'largewings', comms: 'hga', instruments: ['hyperspectral', 'highres', 'magnetometer'], propulsion: 'biprop', adcs: 'star' })}</div>
      </div>
      <div class="features">
        <div class="feat"><b>🧩 Everything connects</b><span>Every instrument adds mass, power, data and cost. Watch the whole system react.</span></div>
        <div class="feat"><b>👥 1–4 players</b><span>Mission Director, Science Lead, Spacecraft Engineer and Flight Ops each own decisions — and goals that pull in different directions.</span></div>
        <div class="feat"><b>🛰️ Real physics, simply explained</b><span>Rocket equation, eclipse power, link budgets, radiation, debris rules — introduced as you play.</span></div>
        <div class="feat"><b>🎲 Launch & operate</b><span>Survive solar storms, failing reaction wheels and budget cuts. Get a mission report that explains why.</span></div>
      </div>
      <p class="muted small footnote">Built for the NASA Space Apps Challenge 2026. Code drafted with AI assistance (Claude) — see README. Values are simplified for play; relationships follow real mission-design principles.</p>
    </div>`;
  }

  // ======================================================================
  //  SETUP (team + difficulty)
  // ======================================================================
  function renderSetup() {
    const roleRows = [...Array(S.nPlayers)].map((_, i) => `
      <div class="playerrow">
        <input class="input" data-a="pname" data-i="${i}" value="${esc(S.players[i])}" maxlength="20" aria-label="Player ${i + 1} name">
        <div class="roles">${rolesOf(i).map(roleChip).join('')}</div>
      </div>`).join('');
    return `<div class="page narrow">
      <button class="btn link back" data-a="go" data-v="home">← Back</button>
      <h2>Assemble your mission team</h2>
      <p class="muted">Play solo (you hold every role) or as a team of up to four sharing one screen. Each role owns part of the design and has a personal goal worth bonus points — negotiate!</p>
      <div class="card">
        <label class="lbl">Team name</label>
        <input class="input" data-a="team" value="${esc(S.team)}" maxlength="28">
        <label class="lbl">Number of players</label>
        <div class="seg">${[1, 2, 3, 4].map(n => `<button class="segbtn ${S.nPlayers === n ? 'on' : ''}" data-a="nplayers" data-v="${n}">${n === 1 ? 'Solo' : n + ' players'}</button>`).join('')}</div>
        <div class="players">${roleRows}</div>
      </div>
      <div class="rolegrid">${G.ROLE_ORDER.map(r => { const R = G.ROLES[r]; return `<div class="rolecard" style="--rc:${R.color}"><div class="ri">${R.icon}</div><b>${R.name}</b><small>Owns: ${R.owns}</small><small class="goal">Personal goal: ${R.goal}</small></div>`; }).join('')}</div>
      <div class="card">
        <label class="lbl">Difficulty</label>
        <div class="diffgrid">${Object.values(G.DIFFICULTY).map(dd => `<button class="diff ${S.difficulty === dd.id ? 'on' : ''}" data-a="difficulty" data-v="${dd.id}"><b>${dd.name}</b><small>${dd.desc}</small></button>`).join('')}</div>
      </div>
      <div class="right"><button class="btn primary big" data-a="go" data-v="scenario">Choose a mission →</button></div>
    </div>`;
  }

  // ======================================================================
  //  SCENARIO SELECT
  // ======================================================================
  function renderScenario() {
    const diff = G.DIFFICULTY[S.difficulty];
    return `<div class="page">
      <button class="btn link back" data-a="go" data-v="setup">← Team</button>
      <h2>Choose your mission</h2>
      <p class="muted">Each mission has a science goal, a budget and a planned lifetime. Budgets shown for <b>${diff.name}</b> difficulty.</p>
      <div class="scgrid">${G.SCENARIOS.map(sc => `
        <button class="sccard" data-a="scenario" data-v="${sc.id}">
          <div class="scicon">${sc.icon}</div>
          <div class="sctop"><b>${sc.name}</b><span class="tag">${sc.level}</span></div>
          <p>${sc.blurb}</p>
          <div class="scmeta"><span>📍 ${sc.body}</span><span>💰 ${sc.sandbox ? 'Unlimited' : money(sc.budget * diff.budgetMult)}</span><span>⏳ ${sc.years} yr</span></div>
          <div class="scobj"><b>Primary goal:</b> ${sc.primary.text}</div>
        </button>`).join('')}</div>
    </div>`;
  }

  // ======================================================================
  //  DESIGN WORKSPACE
  // ======================================================================
  function renderDesign() {
    const d = S.design, m = G.analyze(d), sc = m.scenario;
    const step = STEPS.find(s => s.id === S.step);
    const stepStatus = s => {
      const map = { mission: ['risk'], orbit: ['orbit'], payload: ['instruments'], spacecraft: ['bus', 'power', 'battery', 'adcs', 'computer', 'propulsion', 'thermal'], comms: ['ground', 'comms'], launch: ['launcher'], review: [] };
      const f = map[s.id];
      if (s.id === 'review') return m.blocks.length ? 'todo' : 'done';
      const done = f.every(k => k === 'instruments' ? d.instruments.length : d[k]);
      const issues = m.checks.filter(c => (c.status === 'block' || c.status === 'fail') && c.id !== 'missing' && c.role === s.role).length;
      return !done ? 'todo' : issues ? 'issue' : 'done';
    };
    const nav = STEPS.map((s, i) => {
      const st = stepStatus(s);
      const owner = s.role ? playerName(ownerOf(s.role)) : 'Whole team';
      return `<button class="navstep ${S.step === s.id ? 'on' : ''} st-${st}" data-a="step" data-v="${s.id}">
        <span class="num">${st === 'done' ? '✓' : st === 'issue' ? '!' : i + 1}</span>
        <span class="nt"><b>${s.icon} ${s.name}</b><small>${s.role ? G.ROLES[s.role].name : 'Sign-off'}${S.nPlayers > 1 ? ' · ' + esc(owner) : ''}</small></span></button>`;
    }).join('');

    let body = '';
    switch (S.step) {
      case 'mission': body = stepMission(d, m); break;
      case 'orbit': body = stepOrbit(d, m); break;
      case 'payload': body = stepPayload(d, m); break;
      case 'spacecraft': body = stepSpacecraft(d, m); break;
      case 'comms': body = stepComms(d, m); break;
      case 'launch': body = stepLaunch(d, m); break;
      case 'review': body = stepReview(d, m); break;
    }
    const idx = STEPS.findIndex(s => s.id === S.step);
    const turn = step.role && S.nPlayers > 1 ? `<div class="turn" style="--rc:${G.ROLES[step.role].color}">🎮 <b>${esc(playerName(ownerOf(step.role)))}</b>, you're up as ${G.ROLES[step.role].name}. Others: advise — but it's their call.</div>` : '';
    const hintList = hints() && step.role ? m.checks.filter(c => c.role === step.role && c.status !== 'ok' && c.id !== 'missing').slice(0, 2) : [];
    const hintHtml = hintList.length ? `<div class="hint">💡 <b>Hint:</b> ${hintList.map(c => `${esc(c.label)} — ${esc(c.msg)}`).join('<br>')}</div>` : '';

    return `<div class="topbar">
        <button class="btn link" data-a="confirmhome">⟵ Exit</button>
        <div class="tb-title">${sc.icon} <b>${sc.name}</b> <span class="muted">· ${G.DIFFICULTY[d.difficulty].name}</span></div>
        <div class="tb-team">${[...Array(S.nPlayers)].map((_, i) => `<span class="pchip" title="${rolesOf(i).map(r => G.ROLES[r].name).join(', ')}">${rolesOf(i).map(r => G.ROLES[r].icon).join('')} ${esc(playerName(i))}</span>`).join('')}</div>
        <button class="btn link" data-a="modal" data-v="handbook">📘 Handbook</button>
      </div>
      <div class="workspace">
        <nav class="steps">${nav}<div class="navfoot"><button class="btn link small" data-a="modal" data-v="share">🔗 Share design code</button></div></nav>
        <main class="main">
          ${turn}${hintHtml}
          ${body}
          <div class="stepnav">
            ${idx > 0 ? `<button class="btn ghost" data-a="step" data-v="${STEPS[idx - 1].id}">← ${STEPS[idx - 1].name}</button>` : '<span></span>'}
            ${idx < STEPS.length - 1 ? `<button class="btn primary" data-a="step" data-v="${STEPS[idx + 1].id}">${STEPS[idx + 1].name} →</button>` : ''}
          </div>
        </main>
        <aside class="side">${renderSide(d, m)}</aside>
      </div>`;
  }

  // ---------- option card ----------
  function optCard(field, opt, d, { stats = [], badge = '', disabled = false, multi = false, extra = '' } = {}) {
    const on = multi ? d.instruments.includes(opt.id) : d[field] === opt.id;
    return `<button class="opt ${on ? 'on' : ''} ${disabled ? 'dis' : ''}" data-a="${multi ? 'toggleinst' : 'set'}" data-f="${field}" data-v="${opt.id}" ${disabled ? 'aria-disabled="true"' : ''}>
      <div class="opt-h"><b>${esc(opt.name)}</b>${badge}</div>
      ${opt.example ? `<div class="ex">${esc(opt.example)}</div>` : ''}
      <div class="stats">${stats.filter(Boolean).map(s => `<span>${s}</span>`).join('')}</div>
      ${opt.learn ? `<div class="learn">${esc(opt.learn)}</div>` : ''}${extra}
      <span class="check">${on ? '✓' : ''}</span>
    </button>`;
  }
  const sect = (title, intro, inner, cls = '') => `<section class="sect ${cls}"><h3>${title}</h3>${intro ? `<p class="intro">${intro}</p>` : ''}<div class="opts">${inner}</div></section>`;

  // ---------- STEP: mission ----------
  function stepMission(d, m) {
    const sc = m.scenario;
    return `<section class="brief">
        <div class="briefhead"><span class="bigicon">${sc.icon}</span><div><h2>${sc.name}</h2><div class="muted">Target: ${sc.body} · Budget ${sc.sandbox ? 'unlimited' : money(m.cost.budget)} · Planned life ${sc.years} yr</div></div></div>
        <p>${sc.blurb}</p>
        <div class="objectives">
          <div class="obj primary"><span>PRIMARY</span>${sc.primary.text}<small>${sc.primary.why}</small></div>
          ${sc.secondary.map(o => `<div class="obj"><span>SECONDARY</span>${o.text}</div>`).join('')}
        </div>
      </section>
      <section class="sect">
        <h3>Mission duration</h3>
        <p class="intro">Longer missions return more science but cost more to operate, need more fuel for station-keeping and let solar cells degrade further.</p>
        <div class="slider"><input type="range" min="1" max="10" step="1" value="${d.years}" data-a="years" aria-label="Mission years"><b>${d.years} year${d.years > 1 ? 's' : ''}</b><span class="muted">Science target assumes ${sc.years} yr. Ops cost ${money(m.cost.opsYear)}/yr.</span></div>
      </section>
      ${sect('Risk class', 'How much testing and backup hardware? NASA formally assigns every mission a risk class.',
        G.RISK.map(r => optCard('risk', r, d, { stats: [`Cost ×${r.costMult}`, `Mass ×${r.massMult}`, r.redundancy ? 'Backups ✓' : 'No backups'] })).join(''))}`;
  }

  // ---------- STEP: orbit ----------
  function stepOrbit(d, m) {
    const sc = m.scenario;
    const cards = G.ORBITS.map(o => {
      const fit = sc.orbitFit[o.id] || 0;
      const badge = sc.sandbox ? '' : fit >= 1 ? '<span class="badge good">Ideal</span>' : fit >= 0.7 ? '<span class="badge ok">Good</span>' : fit > 0 ? `<span class="badge warn">${Math.round(fit * 100)}% science</span>` : '<span class="badge bad">Can\'t reach goal</span>';
      return optCard('orbit', o, d, { badge, stats: [o.short, o.eclipseMin ? `☾ ${o.eclipseMin} min shadow/orbit` : '☀ Always sunlit', o.dvInsert ? `Capture Δv ${o.dvInsert} m/s` : 'No capture burn', `Radiation ${['', 'low', 'medium', 'high'][o.radiation]}`] });
    }).join('');
    return `<div class="orbitview">${V.orbit(d.orbit)}</div>${sect('Where will your spacecraft operate?', 'The orbit sets what you can see, how much sunlight you get, how hard it is to talk home, and how much fuel you need.', cards)}`;
  }

  // ---------- STEP: payload ----------
  function stepPayload(d, m) {
    const sc = m.scenario;
    const list = G.INSTRUMENTS.slice().sort((a, b) => (sc.instFit[b.id] || 0) - (sc.instFit[a.id] || 0));
    const cards = list.map(i => {
      const fit = sc.instFit[i.id] || 0;
      const stars = fit >= 1 ? '★★★' : fit >= 0.7 ? '★★☆' : fit > 0.2 ? '★☆☆' : '';
      const prim = (sc.primary.anyOf || sc.primary.allOf || []).includes(i.id) && !sc.sandbox;
      const badge = `${prim ? '<span class="badge good">Primary goal</span>' : sc.secondary.some(o => o.anyOf.includes(i.id)) ? '<span class="badge ok">Secondary goal</span>' : ''}${stars ? `<span class="stars" title="Science value for this mission">${stars}</span>` : '<span class="badge dim">Off-mission</span>'}`;
      return optCard('instruments', i, d, { multi: true, badge, stats: [`${i.mass} kg`, `${i.power} W`, money(i.cost), `${i.data} Gb/day`, `Pointing ${i.pointing}°`, i.trl < 9 ? `TRL ${i.trl}` : ''] });
    }).join('');
    const sel = m.insts;
    return `<section class="sect"><h3>Choose your science payload</h3><p class="intro">Instruments are why the mission exists — and they drive everything else. Pick the ones that answer your science question. <b>${sel.length}</b> selected · ${fmt(m.mass.instMass)} kg · ${fmt(sel.reduce((s, i) => s + i.power, 0))} W · ${fmt(sel.reduce((s, i) => s + i.data, 0), 1)} Gb/day</p>
      ${sc.sandbox ? '' : `<div class="goalbar"><b>Goals:</b> ${goalPill(sc.primary, d)} ${sc.secondary.map(o => goalPill(o, d)).join(' ')}</div>`}
      <div class="opts">${cards}</div></section>`;
  }
  function goalPill(o, d) {
    const ok = G.objectivePossible(o, d.instruments);
    return `<span class="gpill ${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${esc(o.text)}</span>`;
  }

  // ---------- STEP: spacecraft ----------
  function stepSpacecraft(d, m) {
    const bus = G.get.bus(d.bus);
    const busCards = G.BUSES.map(b => optCard('bus', b, d, { stats: [`${b.mass} kg`, money(b.cost), `Payload ≤ ${b.payloadMass} kg`, `${b.slots} instrument slots`, `Ops ${money(b.opsYear)}/yr`],
      badge: m.mass.instMass > b.payloadMass || d.instruments.length > b.slots ? '<span class="badge bad">Payload won\'t fit</span>' : '' })).join('');
    const powerCards = G.POWER.map(p => {
      const tooBig = bus && ((p.type === 'solar' && p.tier > bus.maxPowerTier) || (p.type === 'rtg' && !bus.rtgOk));
      const eff = m.orbit && p.type === 'solar' ? p.watts * m.orbit.solar : p.watts;
      return optCard('power', p, d, { disabled: tooBig, badge: tooBig ? '<span class="badge bad">Bus too small</span>' : '', stats: [`${p.watts} W${m.orbit && m.orbit.solar < 1 && p.type === 'solar' ? ` (${fmt(eff)} W at ${m.orbit.name.split(' ')[0]})` : ''}`, `${p.mass} kg`, money(p.cost)] });
    }).join('');
    const batCards = G.BATTERIES.map(b => optCard('battery', b, d, { stats: [`${b.wh} Wh`, `${b.mass} kg`, money(b.cost)], badge: m.orbit && d.power ? (b.wh >= m.battery.need ? '<span class="badge good">Enough</span>' : '<span class="badge warn">Too small</span>') : '' })).join('');
    const adcsCards = G.ADCS.map(a => optCard('adcs', a, d, { stats: [`±${a.pointing}°`, `${fmt(a.mass * (bus ? bus.massMult : 1), 1)} kg`, `${fmt(a.power * (bus ? bus.powerMult : 1))} W`, money(a.cost * (bus ? bus.costMult : 1))],
      badge: m.orbit && a.earthOnly && m.orbit.body !== 'earth' ? '<span class="badge bad">Earth only</span>' : d.instruments.length ? (a.pointing <= m.pointing.need ? '<span class="badge good">Meets pointing</span>' : '<span class="badge warn">Too coarse</span>') : '' })).join('');
    const compCards = G.COMPUTERS.map(c => optCard('computer', c, d, { stats: [`Radiation tolerance ${['', 'low', 'medium', 'high'][c.radTol]}`, `${c.power} W`, money(c.cost), c.reduction < 1 ? 'Data ×0.5' : ''],
      badge: m.orbit ? (c.radTol >= m.orbit.radiation ? '<span class="badge good">Safe here</span>' : '<span class="badge warn">Radiation risk</span>') : '' })).join('');
    const propCards = G.PROPULSION.map(p => optCard('propulsion', p, d, { stats: [p.id === 'none' ? '0 m/s' : `Isp ${p.isp} s`, p.maxDv ? `≤ ${p.maxDv} m/s` : '', p.power ? `${p.power} W` : '', money(p.cost * (bus ? bus.costMult : 1))],
      badge: m.orbit ? (p.maxDv >= m.dv.need ? '<span class="badge good">Enough Δv</span>' : p.maxDv >= m.orbit.dvInsert && m.orbit.dvInsert > 0 ? '<span class="badge warn">Partial</span>' : m.orbit.dvInsert > p.maxDv ? '<span class="badge bad">Can\'t capture</span>' : '<span class="badge warn">Partial</span>') : '' })).join('');
    const thermCards = G.THERMAL.map(t => optCard('thermal', t, d, { stats: [t.mass ? `+${t.mass} kg` : `+${t.massFrac * 100}% mass`, t.power ? `+${t.power} W` : t.powerFrac ? `+${t.powerFrac * 100}% power` : '0 W', money(t.id === 'cryo' ? t.cost : t.cost * (bus ? bus.costMult : 1))] })).join('');

    const dvNote = m.orbit ? `This orbit needs <b>${fmt(m.dv.need)} m/s</b> of Δv over ${d.years} yr (capture ${m.orbit.dvInsert} + ${m.orbit.dvYear}/yr upkeep + ${m.orbit.dvDispose} disposal). Propellant mass follows the <i>rocket equation</i>: m<sub>prop</sub> = m<sub>dry</sub>·(e<sup>Δv/(Isp·g₀)</sup> − 1) → currently <b>${fmt(m.mass.prop)} kg</b> of propellant.` : 'Choose an orbit first to see how much Δv you need.';
    const pwrNote = m.orbit ? (m.orbit.eclipseMin ? `In ${m.orbit.name} you spend <b>${m.orbit.eclipseMin} of every ${m.orbit.periodMin} min</b> in shadow, so arrays must power the spacecraft <i>and</i> recharge the battery. Current need: <b>${fmt(m.power.required)} W</b> from arrays.` : `${m.orbit.name} is in constant sunlight. Current need: <b>${fmt(m.power.required)} W</b>.`) + (m.orbit.solar < 1 ? ` Sunlight is only ${Math.round(m.orbit.solar * 100)}% of Earth's here.` : '') : '';

    return [
      sect('Spacecraft bus', 'The bus is the body: structure, wiring, basic avionics. It sets how much payload you can carry.', busCards),
      sect('Power source', pwrNote + ' Arrays lose ~2.5% per year, so they\'re sized for end of life.', powerCards),
      sect('Battery', m.orbit && d.power ? `Battery must cover <b>${fmt(m.battery.need)} Wh</b> (shadow time × load ÷ allowed depth-of-discharge ${Math.round(m.battery.dod * 100)}%).` : 'Stores energy for eclipses, launch and emergencies.', batCards),
      sect('Attitude control (pointing)', d.instruments.length ? `Your payload and antenna need pointing to <b>±${m.pointing.need}°</b>.` : 'Keeps the spacecraft facing the right way.', adcsCards),
      sect('Flight computer', m.orbit ? `Radiation in ${m.orbit.name}: <b>${['', 'low', 'medium', 'high'][m.orbit.radiation]}</b>.` : '', compCards),
      sect('Propulsion', dvNote, propCards),
      sect('Thermal control', m.orbit && m.orbit.thermal > 1 ? `<b>${m.orbit.name}</b> has extreme temperature swings.` : 'Space is both scorching (in sunlight) and freezing (in shadow).', thermCards),
    ].join('');
  }

  // ---------- STEP: comms ----------
  function stepComms(d, m) {
    const o = m.orbit;
    const dist = o ? o.dist : null;
    const groundCards = G.GROUND.map(g => optCard('ground', g, d, { stats: [money(g.costYear) + '/yr', o ? `${g.hours[dist]} h/day contact here` : ''], badge: o && !g.hours[dist] ? '<span class="badge bad">Can\'t reach</span>' : '' })).join('');
    const commCards = G.COMMS.map(c => {
      const rate = o ? c.rate[dist] : null;
      return optCard('comms', c, d, { stats: [o ? (rate ? `${rate >= 1 ? fmt(rate) : rate} Mbps here` : 'No signal here') : '', `${c.mass} kg`, `${c.power} W`, money(c.cost), `Pointing ${c.pointing}°`],
        badge: o && !rate ? '<span class="badge bad">Too weak</span>' : c.risky ? '<span class="badge warn">Experimental</span>' : '' });
    }).join('');
    const pct = Math.min(200, m.data.ratio * 100);
    const dataBox = `<div class="databox">
      <div><small>Produced</small><b>${fmt(m.data.gen, 1)} Gb/day</b></div>
      <div class="arrow">→</div>
      <div><small>Downlink = rate × contact time</small><b>${fmt(m.data.rate, 2)} Mbps × ${m.data.hours} h = ${fmt(m.data.down, 1)} Gb/day</b></div>
      <div class="bar"><i style="width:${pct / 2}%" class="${m.data.ratio >= 1 ? 'ok' : m.data.ratio > 0.5 ? 'warn' : 'bad'}"></i></div>
      <div class="muted small">${m.data.gen ? `${Math.round(m.data.ratio * 100)}% of your data can reach Earth.` : 'Add instruments to see the data budget.'}</div></div>`;
    return `${dataBox}${sect('Ground network', o ? `How many hours per day can you talk to the spacecraft from ${o.name}?` : 'Choose an orbit first.', groundCards)}
      ${sect('Spacecraft radio', 'Signal strength falls with distance squared: a radio that streams video from LEO can barely whisper from Mars.', commCards)}`;
  }

  // ---------- STEP: launch ----------
  function stepLaunch(d, m) {
    const o = m.orbit;
    const cards = G.LAUNCHERS.map(l => {
      const cap = o ? (l.cap[o.id] || 0) : null;
      let badge = '';
      if (o) badge = !cap ? '<span class="badge bad">Can\'t reach</span>' : m.mass.wet > cap ? '<span class="badge bad">Too heavy</span>' : `<span class="badge good">${Math.round((1 - m.mass.wet / cap) * 100)}% margin</span>`;
      const busTooBig = l.maxBus && d.bus && G.BUSES.findIndex(b => b.id === d.bus) > G.BUSES.findIndex(b => b.id === l.maxBus);
      if (busTooBig) badge = '<span class="badge bad">Bus too big</span>';
      return optCard('launcher', l, d, { badge, stats: [money(l.cost), `${Math.round(l.reliability * 100)}% success rate`, o ? (cap ? `${fmt(cap)} kg to ${o.short.split(' ·')[0]}` : `0 kg to ${o.short.split(' ·')[0]}`) : ''] });
    }).join('');
    return `<section class="sect"><div class="massbox"><div><small>Dry mass</small><b>${fmt(m.mass.dry)} kg</b></div><div>+</div><div><small>Propellant</small><b>${fmt(m.mass.prop)} kg</b></div><div>=</div><div><small>Launch mass</small><b>${fmt(m.mass.wet)} kg</b></div></div></section>
      ${sect('Launch vehicle', 'Bigger rockets lift more, farther — for a lot more money. Reliability matters too: you only get one spacecraft.', cards)}`;
  }

  // ---------- STEP: review ----------
  function stepReview(d, m) {
    const key = designKey();
    const statusIcon = { block: '⛔', fail: '❌', warn: '⚠️', ok: '✅' };
    const checks = m.checks.map(c => `<div class="chk st-${c.status}"><span class="ci">${statusIcon[c.status]}</span><div><b>${esc(c.label)}</b> <span class="owner">${roleChip(c.role)}</span><div>${esc(c.msg)}</div>${c.why && c.status !== 'ok' ? `<small>Why it matters: ${esc(c.why)}</small>` : ''}</div></div>`).join('');
    const c = m.cost;
    const costRows = [['Spacecraft hardware', c.hardware], ['Assembly, integration & test (15%)', c.integration], [`Risk class ${m.risk.id} premium`, c.riskPremium], ['Launch', c.launch], [`Operations (${m.years} yr × ${money(c.opsYear)})`, c.operations]];
    const goals = G.ROLE_ORDER.map(r => `<div class="goalrow ${m.roleGoals[r] ? 'met' : ''}">${roleChip(r)}<span>${G.ROLES[r].goal}</span><b>${m.roleGoals[r] ? 'On track' : 'Not yet'}</b></div>`).join('');
    const allSigned = [...Array(S.nPlayers)].every((_, i) => S.signoff[i] === key);
    const canLaunch = !m.blocks.length && allSigned && (!m.fails.length || S.override);
    const signRows = [...Array(S.nPlayers)].map((_, i) => {
      const signed = S.signoff[i] === key;
      return `<div class="signrow"><span>${rolesOf(i).map(r => G.ROLES[r].icon).join('')} <b>${esc(playerName(i))}</b></span>
        <button class="btn ${signed ? 'go' : 'ghost'}" data-a="sign" data-i="${i}">${signed ? '✅ GO' : 'Sign GO'}</button></div>`;
    }).join('');
    return `<section class="sect"><h3>Design review</h3><p class="intro">Real missions pass a series of formal reviews before launch. Every role checks the whole system. ⛔ must be fixed. ❌ will badly hurt the mission (you can override, at −50 points each). ⚠️ are risks you may accept.</p>
        <div class="summary">
          <div class="sum"><small>Science potential</small><b class="${m.science.potential >= 1 ? 'ok' : m.science.potential >= 0.6 ? 'warn' : 'bad'}">${Math.round(m.science.potential * 100)}%</b><span>of target</span></div>
          <div class="sum"><small>Total cost</small><b>${money(c.total)}</b><span>of ${m.scenario.sandbox ? '∞' : money(c.budget)}</span></div>
          <div class="sum"><small>Launch mass</small><b>${fmt(m.mass.wet)} kg</b><span>${m.mass.cap ? 'of ' + fmt(m.mass.cap) + ' kg' : '—'}</span></div>
          <div class="sum"><small>Issues</small><b>${m.blocks.length + m.fails.length}</b><span>${m.warns.length} warnings</span></div>
        </div>
        <div class="checks">${checks}</div></section>
      <section class="sect two">
        <div><h3>Cost breakdown</h3><table class="tbl">${costRows.map(([k, v]) => `<tr><td>${k}</td><td>${money(v)}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td>${money(c.total)}</td></tr><tr><td>Reserve</td><td class="${c.reserve < 0 ? 'bad' : ''}">${m.scenario.sandbox ? '—' : money(c.reserve)}</td></tr></table></div>
        <div><h3>Team goals</h3>${goals}<p class="muted small">Each personal goal met at the end earns +40 points.</p></div>
      </section>
      <section class="sect launchpad">
        <h3>GO / NO-GO poll</h3>
        <p class="intro">${S.nPlayers > 1 ? 'Every team member must sign GO. Any change to the design resets the poll.' : 'Sign off when you\'re confident in the design.'}</p>
        ${signRows}
        ${m.fails.length && !m.blocks.length ? `<label class="override"><input type="checkbox" data-a="override" ${S.override ? 'checked' : ''}> Launch anyway with ${m.fails.length} unresolved ❌ issue${m.fails.length > 1 ? 's' : ''} (−${50 * m.fails.length} pts)</label>` : ''}
        <button class="btn primary huge" data-a="launch" ${canLaunch ? '' : 'disabled'}>🚀 Launch mission</button>
        ${!canLaunch ? `<div class="muted small">${m.blocks.length ? 'Fix all ⛔ items first.' : !allSigned ? 'Waiting for GO from every team member.' : 'Resolve ❌ items or tick override.'}</div>` : ''}
      </section>`;
  }

  // ---------- SIDE PANEL ----------
  function gauge(label, used, cap, text, opts = {}) {
    const frac = cap > 0 ? used / cap : (used > 0 ? 2 : 0);
    let cls = frac <= (opts.warnAt || 0.9) ? 'ok' : frac <= 1 ? 'warn' : 'bad';
    if (opts.invert) cls = frac >= 1 ? 'ok' : frac >= (opts.warnAt || 0.7) ? 'warn' : 'bad';
    if (opts.na) cls = 'na';
    return `<div class="gauge ${cls}"><div class="gl"><span>${label}</span><b>${text}</b></div><div class="gb"><i style="width:${Math.min(100, frac * 100)}%"></i></div></div>`;
  }
  function renderSide(d, m) {
    const c = m.cost;
    const sci = m.science.potential;
    return `<div class="crafthold">${V.craft(d)}</div>
      <div class="scimeter"><div><small>Science potential</small><b>${Math.round(sci * 100)}%</b></div><div class="gb big"><i style="width:${Math.min(100, sci / 1.3 * 100)}%" class="${sci >= 1 ? 'ok' : sci >= 0.6 ? 'warn' : 'bad'}"></i><span class="tgt" style="left:${100 / 1.3}%"></span></div></div>
      <div class="gauges">
        ${gauge('💰 Budget', c.total, m.scenario.sandbox ? c.total * 2 : c.budget, `${money(c.total)} / ${m.scenario.sandbox ? '∞' : money(c.budget)}`)}
        ${gauge('⚖️ Launch mass', m.mass.wet, m.mass.cap, d.launcher && d.orbit ? `${fmt(m.mass.wet)} / ${fmt(m.mass.cap)} kg` : `${fmt(m.mass.wet)} kg`, { na: !d.launcher || !d.orbit })}
        ${gauge('📦 Payload', m.mass.instMass, m.mass.payloadCap, d.bus ? `${fmt(m.mass.instMass)} / ${m.mass.payloadCap} kg` : `${fmt(m.mass.instMass)} kg`, { na: !d.bus })}
        ${gauge('⚡ Power', m.power.required, m.power.availEOL, d.power && d.orbit ? `${fmt(m.power.required)} / ${fmt(m.power.availEOL)} W` : `${fmt(m.power.load)} W load`, { na: !d.power || !d.orbit, warnAt: 0.85 })}
        ${gauge('🔋 Battery', m.battery.need, m.battery.have, d.battery ? `${fmt(m.battery.need)} / ${m.battery.have} Wh` : '—', { na: !d.battery || !d.orbit })}
        ${gauge('📡 Data', m.data.gen, m.data.down, d.comms && d.ground && d.orbit ? `${fmt(m.data.gen, 1)} / ${fmt(m.data.down, 1)} Gb/day` : `${fmt(m.data.gen, 1)} Gb/day`, { na: !d.comms || !d.ground || !d.orbit })}
        ${gauge('🔥 Δv', m.dv.need, m.dv.cap, d.propulsion && d.orbit ? `${fmt(m.dv.need)} / ${fmt(m.dv.cap)} m/s` : '—', { na: !d.propulsion || !d.orbit, warnAt: 0.95 })}
        ${gauge('🎯 Pointing', m.pointing.have <= m.pointing.need ? 0.5 : 2, 1, d.adcs && d.instruments.length ? `need ${m.pointing.need}° · have ${m.pointing.have}°` : '—', { na: !d.adcs || !d.instruments.length })}
      </div>
      <div class="issues">${m.blocks.length + m.fails.length ? `<b>${m.blocks.length + m.fails.length} issue${m.blocks.length + m.fails.length > 1 ? 's' : ''}</b> · ` : ''}${m.warns.length} warning${m.warns.length === 1 ? '' : 's'} <button class="btn link small" data-a="step" data-v="review">Review →</button></div>`;
  }

  // ======================================================================
  //  SIMULATION SCREEN
  // ======================================================================
  function renderSim() {
    const sim = S.sim, m = sim.m;
    return `<div class="topbar"><div class="tb-title">${m.scenario.icon} <b>${m.scenario.name}</b> · Mission Control</div><div class="tb-team">${esc(S.team)}</div></div>
      <div class="simwrap">
        <div class="simview">
          <div id="simscene" class="simscene"></div>
          <div class="simstats">
            <div><small>Phase</small><b id="simphase">—</b></div>
            <div><small>Mission clock</small><b id="simclock">—</b></div>
            <div><small>Reserve</small><b id="simreserve">—</b></div>
          </div>
          <div class="gauge" id="g-health"><div class="gl"><span>❤️ Spacecraft health</span><b></b></div><div class="gb"><i></i></div></div>
          <div class="gauge" id="g-sci"><div class="gl"><span>🔬 Science returned (vs. target)</span><b></b></div><div class="gb"><i></i></div></div>
          <div class="simctrl">
            <button class="btn ghost" data-a="pause">${S.paused ? '▶ Resume' : '⏸ Pause'}</button>
            ${[1, 3, 8].map(x => `<button class="btn ${S.speed === x ? 'primary' : 'ghost'}" data-a="speed" data-v="${x}">${x}×</button>`).join('')}
          </div>
        </div>
        <div class="simlog"><h3>Mission log</h3><div id="loglist"></div></div>
      </div>`;
  }
  function updateSimLive() {
    const sim = S.sim; if (!sim) return;
    const m = sim.m, c = sim.ctx;
    const phaseName = { prelaunch: 'Countdown', launch: 'Launch', deploy: 'Deployment', cruise: 'Cruise', insertion: 'Orbit insertion', ops: 'Science operations', 'extend?': 'Extension review' }[sim.phase] || 'Complete';
    const scene = $('#simscene');
    if (scene) {
      const want = (sim.phase === 'prelaunch' || sim.phase === 'launch') ? 'launch' : 'orbit';
      if (scene.dataset.mode !== want) { scene.dataset.mode = want; scene.innerHTML = want === 'launch' ? `<div class="launchscene">${V.rocket()}<div class="pad"></div></div>` : V.orbit(m.orbit.id, { big: true }); }
    }
    const set = (id, t) => { const el = $(id); if (el) el.textContent = t; };
    set('#simphase', sim.done ? 'Complete' : phaseName);
    set('#simclock', `Month ${c.month} / ${sim.totalMonths + sim.extendedMonths}`);
    set('#simreserve', money(c.reserve));
    const hg = $('#g-health'); if (hg) { const h = Math.max(0, c.health); hg.className = 'gauge ' + (h > 0.7 ? 'ok' : h > 0.4 ? 'warn' : 'bad'); hg.querySelector('b').textContent = Math.round(h * 100) + '%'; hg.querySelector('i').style.width = h * 100 + '%'; }
    const sg = $('#g-sci'); if (sg) { const p = sim.science / (m.scenario.sciTarget * m.years); sg.className = 'gauge ' + (p >= 1 ? 'ok' : 'warn'); sg.querySelector('b').textContent = Math.round(p * 100) + '%'; sg.querySelector('i').style.width = Math.min(100, p * 100) + '%'; }
    const ll = $('#loglist');
    if (ll && ll.childElementCount !== sim.log.length) {
      ll.innerHTML = sim.log.slice().reverse().map(e => `<div class="logi ${e.kind}"><span>M${e.month}</span>${esc(e.t)}</div>`).join('');
    }
  }
  function startSim() {
    S.attempts++;
    S.sim = G.createSim(JSON.parse(JSON.stringify(S.design)), (Date.now() ^ (S.attempts * 7919)) >>> 0);
    S.paused = false; S.speed = 1; S.votes = {}; S.eventResult = null;
    go('sim');
    schedule();
  }
  function schedule() {
    clearTimeout(S.timer);
    if (S.screen !== 'sim') return;
    const sim = S.sim;
    if (sim.done) { S.timer = setTimeout(() => { S.lastResult = { design: JSON.parse(JSON.stringify(S.design)), outcome: sim.outcome, sim }; saveScore(); go('report'); }, 1600); return; }
    if (sim.pendingEvent) { if (!S.modal) { S.modal = 'event'; S.shownEvent = sim.pendingEvent; S.votes = {}; S.eventResult = null; render(); } return; }
    if (sim.phase === 'extend?') { if (!S.modal) { S.modal = 'extend'; render(); } return; }
    if (S.paused) return;
    const slowPhases = { prelaunch: 1600, launch: 2600, deploy: 1400, cruise: 1600, insertion: 1500 };
    const delay = (slowPhases[sim.phase] || 380) / S.speed;
    S.timer = setTimeout(() => { sim.step(); updateSimLive(); schedule(); }, delay);
  }
  function saveScore() {
    const r = S.lastResult; if (!r) return;
    const lb = store.get('ma_leaderboard', []);
    lb.push({ team: S.team, scenario: r.design.scenario, difficulty: r.design.difficulty, score: r.outcome.total, stars: r.outcome.stars, outcome: r.outcome.outcome, date: new Date().toISOString().slice(0, 10), code: G.encode(r.design) });
    lb.sort((a, b) => b.score - a.score);
    store.set('ma_leaderboard', lb.slice(0, 50));
  }

  // ======================================================================
  //  REPORT
  // ======================================================================
  function renderReport() {
    const { design: d, outcome: o, sim } = S.lastResult;
    const m = sim.m, sc = m.scenario;
    const banner = { success: ['Mission success!', 'good', 'All primary goals achieved over the full mission.'], partial: ['Partial success', 'warn', 'The mission returned useful science but fell short of its full goals.'], failure: ['Mission lost', 'bad', sim.lostReason || 'The mission did not achieve its goals.'] }[o.outcome];
    const rows = [
      ['Science returned', `${Math.round(o.sciPct * 100)}% of target`, o.sciencePts],
      ['Primary objective', o.primary ? '✓ ' + sc.primary.text : '✗ ' + sc.primary.text, o.primaryPts],
      ...o.secondary.map(s => ['Secondary objective', (s.met ? '✓ ' : '✗ ') + s.text, s.met ? 75 : 0]),
      ['Budget efficiency', sc.sandbox ? '—' : `${Math.round(o.reserveFrac * 100)}% of budget left in reserve`, o.efficiencyPts],
      ['Space sustainability', m.orbit.dvDispose ? (sim.disposed ? 'Disposed of safely at end of life' : 'Left behind as space debris') : (sim.lost ? 'Mission lost' : 'Natural disposal / no debris risk'), o.sustainPts],
      ['Team goals', `${Object.values(o.goals).filter(Boolean).length} of 4 met`, o.goalPts],
      ...(o.overridePts ? [['Overridden review issues', `${m.fails.length} ❌ launched anyway`, o.overridePts]] : []),
    ];
    const lessons = buildLessons(m, sim, o);
    const goals = G.ROLE_ORDER.map(r => `<div class="goalrow ${o.goals[r] ? 'met' : ''}">${roleChip(r)}<span>${esc(playerName(ownerOf(r)))}: ${G.ROLES[r].goal}</span><b>${o.goals[r] ? '+40' : '—'}</b></div>`).join('');
    const decisions = sim.decisions.length ? sim.decisions.map(x => `<li><b>${esc(x.event)}</b> → ${esc(x.choice)}<br><small>${esc(x.result)}</small></li>`).join('') : '<li class="muted">No major decisions were needed.</li>';
    return `<div class="page">
      <div class="banner ${banner[1]}"><div><div class="kicker">${sc.icon} ${sc.name} · ${G.DIFFICULTY[d.difficulty].name} · ${esc(S.team)}</div><h1>${banner[0]}</h1><p>${esc(banner[2])}</p></div>
        <div class="scorebox"><div class="stars">${'★'.repeat(o.stars)}${'☆'.repeat(3 - o.stars)}</div><b>${fmt(o.total)}</b><small>points</small></div></div>
      <div class="reportgrid">
        <section class="card"><h3>Score breakdown</h3><table class="tbl">${rows.map(([a, b, c]) => `<tr><td>${a}<br><small class="muted">${esc(b)}</small></td><td class="${c < 0 ? 'bad' : ''}">${c > 0 ? '+' : ''}${c}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td>${fmt(o.total)}</td></tr></table></section>
        <section class="card"><h3>Post-mission analysis — why it went this way</h3><ul class="lessons">${lessons.map(l => `<li class="${l.kind}">${l.text}</li>`).join('')}</ul></section>
        <section class="card"><h3>Mission timeline</h3><div class="miniscroll">${sim.log.map(e => `<div class="logi ${e.kind}"><span>M${e.month}</span>${esc(e.t)}</div>`).join('')}</div></section>
        <section class="card"><h3>Team decisions</h3><ul class="decisions">${decisions}</ul><h3>Team goals</h3>${goals}</section>
        <section class="card wide"><h3>🛰️ Real missions that faced the same problem</h3><p>${esc(sc.real)}</p>
          <div class="specs">${[['Orbit', m.orbit.name], ['Launch', G.get.launcher(d.launcher).name], ['Mass', fmt(m.mass.wet) + ' kg'], ['Power', fmt(m.power.availEOL) + ' W (end of life)'], ['Cost', money(m.cost.total)], ['Instruments', m.insts.map(i => i.name).join(', ')]].map(([a, b]) => `<div><small>${a}</small><b>${esc(b)}</b></div>`).join('')}</div></section>
      </div>
      <div class="cta center">
        <button class="btn primary big" data-a="redesign">🔧 Improve this design</button>
        <button class="btn ghost big" data-a="relaunch">🎲 Fly it again</button>
        <button class="btn ghost big" data-a="go" data-v="scenario">🌍 New mission</button>
        <button class="btn ghost big" data-a="modal" data-v="share">🔗 Share design</button>
        <button class="btn ghost big" data-a="copyreport">📋 Copy report</button>
        <button class="btn ghost big" data-a="modal" data-v="leaderboard">🏆 Leaderboard</button>
      </div>
    </div>`;
  }

  function buildLessons(m, sim, o) {
    const L = [];
    const push = (kind, text) => L.push({ kind, text });
    if (sim.lostReason === 'Launch vehicle failure') push('bad', `The rocket failed (${G.get.launcher(sim.ctx.d.launcher).name}s succeed ~${Math.round(G.get.launcher(sim.ctx.d.launcher).reliability * 100)}% of the time). Bad luck happens: real agencies sometimes buy launch insurance or build a spare.`);
    if (sim.insertionFailed) push('bad', `Not enough Δv to brake into orbit. The capture burn needed ${m.orbit.dvInsert} m/s — a bipropellant engine (high Isp, large tanks) would have done it.`);
    if (m.science.dataFactor < 0.95) push('warn', `Data bottleneck: only ${Math.round(m.data.ratio * 100)}% of collected data reached Earth, costing ~${Math.round((1 - m.science.dataFactor) * 100)}% of science. A faster radio, more ground-station time or onboard processing would help.`);
    if (m.science.powerFactor < 1) push('warn', `Power deficit: instruments could only run ${Math.round(m.science.powerFactor * 100)}% of the time. Size arrays for end of life, including eclipse recharging${m.orbit.solar < 1 ? ' and weaker sunlight' : ''}.`);
    m.science.perInst.filter(x => x.factor < 1).forEach(x => push('warn', `${x.name}: ${x.notes.join(', ')} — it returned only ${Math.round(x.factor * 100)}% of its potential.`));
    if (m.science.orbitFit < 1 && m.science.orbitFit > 0) push('warn', `${m.orbit.name} gave only ${Math.round(m.science.orbitFit * 100)}% of the ideal vantage point for this goal.`);
    if (sim.lifeMonths < sim.totalMonths) push('warn', `Station-keeping propellant ran out after ${sim.lifeMonths} months. More Δv margin = longer mission.`);
    if (m.checks.find(c => c.id === 'radiation')) push('warn', 'The flight computer was under-rated for the radiation environment, raising the chance of resets and failures.');
    if (m.checks.find(c => c.id === 'battery' && c.status === 'fail')) push('warn', 'An undersized battery meant brown-outs in every eclipse — a major failure risk.');
    if (sim.lost && sim.lostReason && !sim.insertionFailed && sim.lostReason !== 'Launch vehicle failure') push('bad', `Mission ended by: ${sim.lostReason}. ${m.risk.redundancy ? 'Even with backups, space is unforgiving.' : 'A higher risk class (Class B) adds backup units that often turn fatal failures into recoverable ones.'}`);
    if (m.orbit.dvDispose && !sim.disposed && !sim.lost) push('warn', 'No fuel was left for end-of-life disposal — the satellite now adds to the space-debris problem.');
    if (m.cost.reserve / m.cost.budget < 0.05 && !m.scenario.sandbox) push('warn', 'Almost no budget reserve: the team couldn\'t pay for options when surprises came.');
    if (o.outcome === 'success') push('good', 'Every major subsystem was sized with margin and matched to the orbit. That\'s systems engineering!');
    if (m.power.margin >= 0.2) push('good', `Healthy ${Math.round(m.power.margin * 100)}% power margin protected against degradation and damage.`);
    if (m.data.ratio >= 1) push('good', 'The communications system could send home everything the instruments produced.');
    if (o.sciPct >= 1) push('good', `Science return exceeded the target (${Math.round(o.sciPct * 100)}%).`);
    if (!L.length) push('good', 'A solid, balanced design.');
    return L;
  }

  // ======================================================================
  //  MODALS
  // ======================================================================
  function renderModal() {
    if (!S.modal) return '';
    let inner = '';
    switch (S.modal) {
      case 'howto': inner = `<h2>How to play</h2><ol class="howto">
          <li><b>Build a team</b> (1–4 players). Each player gets one or more roles. Roles own decisions and have personal goals that sometimes conflict — talk it out!</li>
          <li><b>Pick a mission.</b> Each has a science goal, a budget and a planned lifetime.</li>
          <li><b>Design</b> in six steps: Mission → Orbit → Instruments → Spacecraft → Comms → Launch. The panel on the right shows every resource live: budget, mass, power, battery, data, Δv and pointing.</li>
          <li><b>Design review.</b> Fix ⛔ blockers, decide whether to accept ⚠️ risks, then every player signs GO.</li>
          <li><b>Launch & operate.</b> Watch the mission unfold and make team decisions when things go wrong (majority vote; the Mission Director breaks ties).</li>
          <li><b>Read the report.</b> Learn why it worked — or didn't — then improve the design and fly again.</li></ol>
          <p class="muted">Tip: there is never one perfect design. Different combinations can meet the same goal — compare scores with friends using design codes.</p>`; break;
      case 'handbook': inner = handbook(); break;
      case 'leaderboard': {
        const lb = store.get('ma_leaderboard', []);
        inner = `<h2>🏆 Leaderboard</h2>${lb.length ? `<table class="tbl lb"><tr><th>#</th><th>Team</th><th>Mission</th><th>Level</th><th>Result</th><th>Score</th></tr>${lb.slice(0, 20).map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.team)}</td><td>${esc((G.get.scenario(e.scenario) || {}).name || e.scenario)}</td><td>${esc((G.DIFFICULTY[e.difficulty] || {}).name || '')}</td><td>${'★'.repeat(e.stars)}${'☆'.repeat(3 - e.stars)}</td><td><b>${e.score}</b></td></tr>`).join('')}</table>` : '<p class="muted">No missions flown yet on this device.</p>'}<p class="muted small">Scores are saved in this browser only.</p>`; break;
      }
      case 'share': {
        const code = G.encode(S.design || (S.lastResult && S.lastResult.design));
        inner = `<h2>🔗 Share this design</h2><p>Send this code to another team so they can load, fly and compare your exact design.</p><textarea class="code" readonly>${esc(code)}</textarea><button class="btn primary" data-a="copy" data-v="${esc(code)}">Copy code</button> <span id="copied" class="muted"></span>`; break;
      }
      case 'load': inner = `<h2>📥 Load a design code</h2><p>Paste a code from another team (starts with <code>MA1-</code>).</p><textarea class="code" id="loadcode" placeholder="MA1-..."></textarea><button class="btn primary" data-a="loadcode">Load design</button> <span id="loaderr" class="bad"></span>`; break;
      case 'confirmhome': inner = `<h2>Leave this mission?</h2><p>Your current design will be lost (copy its design code first if you want to keep it).</p><div class="cta"><button class="btn primary" data-a="go" data-v="home">Leave</button><button class="btn ghost" data-a="closemodal">Stay</button></div>`; break;
      case 'event': inner = eventModal(); break;
      case 'extend': {
        const x = S.sim.extensionOffer;
        inner = `<div class="evicon">🎉</div><h2>Extended mission proposal</h2><p>Your spacecraft completed its planned mission in good health! Scientists propose one more year of operations.</p>
          <p class="learn">Many famous missions ran far beyond their plan: the Mars rover Opportunity was designed for 90 days and lasted 15 years.</p>
          <ul><li>Cost: ${money(x.cost)} from reserve (you have ${money(S.sim.ctx.reserve)})</li><li>Fuel: ${x.canFuel ? 'enough for another year ✓' : 'not enough station-keeping propellant ✗'}</li></ul>
          <div class="cta"><button class="btn primary" data-a="extend" data-v="1" ${x.canFuel && x.canPay ? '' : 'disabled'}>Extend +1 year</button><button class="btn ghost" data-a="extend" data-v="0">End mission</button></div>`; break;
      }
    }
    const closable = !['event', 'extend'].includes(S.modal);
    return `<div class="modalbg" ${closable ? 'data-a="closemodal"' : ''}><div class="modal" data-stop="1">${closable ? '<button class="x" data-a="closemodal" aria-label="Close">×</button>' : ''}${inner}</div></div>`;
  }

  function eventModal() {
    const sim = S.sim, ev = S.shownEvent || sim.pendingEvent, ctx = sim.ctx;
    if (S.eventResult) return `<div class="evicon">${ev.icon}</div><h2>${ev.title}</h2><p class="result">${esc(S.eventResult)}</p><button class="btn primary" data-a="eventcontinue">Continue mission →</button>`;
    const choices = ev.choices.map((ch, ci) => ({ ch, ci, enabled: !ch.enabled || ch.enabled(ctx) }));
    let voting = '';
    if (S.nPlayers > 1) {
      const counts = choices.map(x => Object.values(S.votes).filter(v => v === x.ci).length);
      const allVoted = Object.keys(S.votes).length === S.nPlayers;
      voting = `<div class="votes">${[...Array(S.nPlayers)].map((_, i) => `<div class="voterow"><span>${rolesOf(i).map(r => G.ROLES[r].icon).join('')} ${esc(playerName(i))}</span><div>${choices.map(x => `<button class="btn small ${S.votes[i] === x.ci ? 'primary' : 'ghost'}" data-a="vote" data-i="${i}" data-v="${x.ci}" ${x.enabled ? '' : 'disabled'}>${esc(x.ch.label)}</button>`).join('')}</div></div>`).join('')}</div>
        <div class="tally">${choices.map((x, k) => `<span>${esc(x.ch.label)}: <b>${counts[k]}</b></span>`).join('')}</div>
        <button class="btn primary" data-a="decide" ${allVoted ? '' : 'disabled'}>Execute team decision</button>`;
    }
    return `<div class="evicon">${ev.icon}</div><h2>${ev.title}</h2><p>${ev.text}</p><p class="learn">📘 ${ev.learn}</p>
      <div class="choices">${choices.map(x => `<div class="choice ${x.enabled ? '' : 'dis'}"><b>${esc(x.ch.label)}</b><small>${esc(x.ch.detail)}${x.enabled ? '' : ' (not available)'}</small>${S.nPlayers === 1 ? `<button class="btn primary small" data-a="choose" data-v="${x.ci}" ${x.enabled ? '' : 'disabled'}>Choose</button>` : ''}</div>`).join('')}</div>
      ${voting}<div class="muted small">Reserve available: ${money(ctx.reserve)}</div>`;
  }

  function handbook() {
    const items = [
      ['Δv (delta-v)', 'The change in velocity a spacecraft can make with its propellant — the "currency" of space travel. Reaching the Moon\'s orbit costs ~800 m/s of braking; staying in a low orbit costs a little every year.'],
      ['Rocket equation', 'Propellant mass grows exponentially with Δv: m_prop = m_dry × (e^(Δv / (Isp·g₀)) − 1). A more efficient engine (higher Isp) needs far less propellant for the same Δv.'],
      ['Specific impulse (Isp)', 'How efficiently an engine uses propellant, in seconds. Cold gas ~70 s, hydrazine ~225 s, bipropellant ~315 s, ion engines ~3000 s.'],
      ['Eclipse', 'Time spent in a planet\'s shadow. Batteries power the spacecraft then, and the arrays must recharge them in sunlight — so arrays need to be bigger than the load.'],
      ['Depth of discharge (DoD)', 'How much of a battery you drain each cycle. A LEO satellite cycles ~5,500 times a year, so engineers drain only ~30% to make batteries last.'],
      ['End-of-life (EOL) power', 'Solar cells degrade in space radiation (~2–3%/yr). Arrays are sized so there is still enough power at the end of the mission.'],
      ['Link budget', 'Signal strength drops with distance squared. Bigger antennas, higher frequencies (X → Ka → laser), more transmit power and bigger ground dishes all increase the data rate.'],
      ['Ground segment', 'Antennas and control centres on Earth. A LEO satellite is visible to one station only a few minutes per pass; deep-space missions need the Deep Space Network.'],
      ['Attitude control (ADCS)', 'The system that knows and controls which way the spacecraft points. Cameras and high-gain antennas need precise pointing.'],
      ['Radiation hardness', 'Space radiation flips bits and damages chips. Rad-hard parts survive the Van Allen belts and deep space, at the cost of speed and money.'],
      ['Risk class', 'NASA classifies missions A (flagship, lowest risk tolerance) to D (cheap, higher risk). Higher classes mean redundancy and more testing.'],
      ['TRL', 'Technology Readiness Level, 1 (idea) to 9 (flight-proven). Low-TRL tech is exciting but riskier.'],
      ['Margin', 'Spare capacity kept on purpose. Mass grows during development and parts degrade in flight — margin is insurance.'],
      ['Space debris & disposal', 'Defunct satellites can collide and create clouds of debris. US rules now require LEO satellites to de-orbit within 5 years of mission end.'],
      ['Lagrange points (L1, L2)', 'Places where the gravity of the Sun and Earth balance the orbital motion, so a spacecraft keeps pace with Earth. L1 faces the Sun; L2 is shaded by Earth.'],
      ['Mission segments', 'Launch segment (rocket), space segment (spacecraft & instruments), ground segment (antennas & control) and user segment (the scientists using the data).'],
    ];
    return `<h2>📘 Mission Handbook</h2><p class="muted">Key ideas used in the game, in plain language.</p><dl class="glossary">${items.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>
      <p class="muted small">Further reading: NASA Mission Design Lab, JPL Concept Maturity Levels, NASA CubeSat 101, and the GMAT mission analysis tool.</p>`;
  }

  // ======================================================================
  //  EVENTS
  // ======================================================================
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-a]');
    if (!t) return;
    if (t.dataset.a === 'closemodal' && e.target.closest('[data-stop]') && !e.target.closest('.x') && !e.target.closest('button')) return;
    const a = t.dataset.a, v = t.dataset.v;
    if (t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    switch (a) {
      case 'newgame': go('setup'); break;
      case 'go': S.modal = null; clearTimeout(S.timer); go(v); break;
      case 'modal': S.modal = v; render(); break;
      case 'closemodal': S.modal = null; render(); break;
      case 'confirmhome': S.modal = 'confirmhome'; render(); break;
      case 'nplayers': S.nPlayers = +v; render(); break;
      case 'difficulty': S.difficulty = v; render(); break;
      case 'scenario': S.design = G.newDesign(v, S.difficulty); S.step = 'mission'; S.signoff = {}; S.override = false; go('design'); break;
      case 'step': { S.step = v; S._keepScroll = false; S.modal = null; render(); const mn = $('.main'); if (mn) mn.scrollTop = 0; window.scrollTo(0, 0); break; }
      case 'set': setDesign(t.dataset.f, v); break;
      case 'toggleinst': {
        const list = S.design.instruments;
        S.design.instruments = list.includes(v) ? list.filter(x => x !== v) : list.concat(v);
        S.signoff = {}; S.override = false; render(); break;
      }
      case 'sign': { const i = +t.dataset.i; const key = designKey(); S.signoff[i] = S.signoff[i] === key ? null : key; render(); break; }
      case 'launch': startSim(); break;
      case 'pause': S.paused = !S.paused; render(); schedule(); break;
      case 'speed': S.speed = +v; render(); schedule(); break;
      case 'choose': resolveEvent(+v); break;
      case 'vote': S.votes[+t.dataset.i] = +v; render(); break;
      case 'decide': {
        const counts = {}; Object.values(S.votes).forEach(x => counts[x] = (counts[x] || 0) + 1);
        const max = Math.max(...Object.values(counts));
        const top = Object.keys(counts).filter(k => counts[k] === max).map(Number);
        const dirVote = S.votes[ownerOf('director')];
        resolveEvent(top.length > 1 && top.includes(dirVote) ? dirVote : top[0]);
        break;
      }
      case 'eventcontinue': S.modal = null; S.eventResult = null; S.shownEvent = null; render(); schedule(); break;
      case 'extend': S.modal = null; S.sim.extend(v === '1'); render(); schedule(); break;
      case 'redesign': S.design = JSON.parse(JSON.stringify(S.lastResult.design)); S.step = 'review'; S.signoff = {}; S.override = false; go('design'); break;
      case 'relaunch': S.design = JSON.parse(JSON.stringify(S.lastResult.design)); startSim(); break;
      case 'copy': copyText(v, '#copied'); break;
      case 'copyreport': copyText(reportText(), null, t); break;
      case 'loadcode': {
        const d = G.decode(($('#loadcode') || {}).value || '');
        if (!d) { const el = $('#loaderr'); if (el) el.textContent = 'That code could not be read.'; break; }
        S.design = d; S.difficulty = d.difficulty || 'engineer'; S.step = 'review'; S.signoff = {}; S.modal = null; go('design'); break;
      }
    }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.a === 'years') { S.design.years = +t.value; const b = t.nextElementSibling; if (b) b.textContent = `${t.value} year${t.value > 1 ? 's' : ''}`; }
    if (t.dataset.a === 'pname') { S.players[+t.dataset.i] = t.value; }
    if (t.dataset.a === 'team') { S.team = t.value; }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.a === 'override') { S.override = t.checked; render(); }
    if (t.dataset.a === 'years') { S.design.years = +t.value; S.signoff = {}; render(); }
    if (t.dataset.a === 'pname') render();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.modal && !['event', 'extend'].includes(S.modal)) { S.modal = null; render(); } });

  function resolveEvent(idx) {
    const sim = S.sim;
    sim.resolve(idx);
    const last = sim.decisions[sim.decisions.length - 1];
    S.eventResult = last ? last.result : '';
    S.votes = {};
    render();
  }

  function copyText(text, statusSel, btn) {
    const done = ok => { if (statusSel && $(statusSel)) $(statusSel).textContent = ok ? 'Copied!' : 'Select the text and copy it manually.'; if (btn) { const o = btn.textContent; btn.textContent = ok ? '✓ Copied' : 'Copy failed'; setTimeout(() => btn.textContent = o, 1500); } };
    try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (e) { done(false); }
  }
  function reportText() {
    const { design: d, outcome: o, sim } = S.lastResult; const m = sim.m;
    return [`MISSION ARCHITECT — ${m.scenario.name} (${G.DIFFICULTY[d.difficulty].name})`, `Team: ${S.team}`, `Result: ${o.outcome.toUpperCase()} — ${o.total} pts ${'★'.repeat(o.stars)}`,
      `Science: ${Math.round(o.sciPct * 100)}% of target · Cost ${money(m.cost.total)} of ${money(m.cost.budget)}`,
      `Orbit: ${m.orbit.name} · Launch: ${G.get.launcher(d.launcher).name} · Mass ${fmt(m.mass.wet)} kg`,
      `Instruments: ${m.insts.map(i => i.name).join(', ')}`, '', 'Timeline:', ...sim.log.map(e => `  M${e.month}: ${e.t}`), '', `Design code: ${G.encode(d)}`].join('\n');
  }

  render();
})();
