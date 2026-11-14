/* ==========================================================================
   MISSION ARCHITECT — SVG visuals (spacecraft builder + orbit diagrams)
   ========================================================================== */
const VIS = (() => {
  const G = GAME;

  function panel(x, y, w, h) {
    let cells = '';
    const cw = w / Math.max(1, Math.round(w / 8)), ch = h / Math.max(1, Math.round(h / 8));
    for (let cx = x + cw; cx < x + w - 0.5; cx += cw) cells += `<line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + h}"/>`;
    for (let cy = y + ch; cy < y + h - 0.5; cy += ch) cells += `<line x1="${x}" y1="${cy}" x2="${x + w}" y2="${cy}"/>`;
    return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="url(#cell)" stroke="#8fb3ff" stroke-width="0.8"/><g stroke="#24407a" stroke-width="0.5">${cells}</g></g>`;
  }

  function craft(d) {
    const bus = G.get.bus(d.bus) ? d.bus : null;
    const size = { cube: [34, 34], small: [58, 52], medium: [82, 72], large: [104, 88] }[bus || 'small'];
    const [bw, bh] = size; const cx = 160, cy = 108;
    const bx = cx - bw / 2, by = cy - bh / 2;
    const pw = G.get.power(d.power);
    const comms = d.comms, insts = d.instruments || [];
    const therm = d.thermal, prop = d.propulsion, adcs = d.adcs;
    let back = '', front = '', top = '', bottom = '';

    // sunshield (cryo) behind & below
    if (therm === 'cryo') {
      for (let i = 0; i < 5; i++) {
        const o = i * 4;
        back += `<polygon points="${cx - 120 + o},${cy + bh / 2 + 20 - i * 2} ${cx},${cy + bh / 2 + 4 - i * 2} ${cx + 120 - o},${cy + bh / 2 + 20 - i * 2} ${cx},${cy + bh / 2 + 36 - i * 2}" fill="${['#b9a3ff', '#c9b6ff', '#d8c9ff', '#e6dbff', '#f3edff'][i]}" opacity="${0.55 + i * 0.08}" stroke="#7d6bd6" stroke-width="0.5"/>`;
      }
    }

    // solar arrays
    if (pw && pw.type === 'solar' && pw.tier > 0) {
      const spec = { 1: [1, 34, 26], 2: [2, 30, 36], 3: [3, 30, 48], 4: [2, 48, 50] }[Math.min(4, pw.tier)];
      const [n, w, h] = spec;
      const gap = 3, boom = 8;
      for (const side of [-1, 1]) {
        const startX = side < 0 ? bx - boom : bx + bw + boom;
        back += `<line x1="${side < 0 ? bx : bx + bw}" y1="${cy}" x2="${startX}" y2="${cy}" stroke="#c9d1e0" stroke-width="2"/>`;
        for (let i = 0; i < n; i++) {
          const x = side < 0 ? startX - (i + 1) * w - i * gap : startX + i * (w + gap);
          back += panel(x, cy - h / 2, w, h);
          if (pw.id === 'huge') back += `<rect x="${side < 0 ? x - 3 : x + w}" y="${cy - h / 2}" width="3" height="${h}" fill="#9aa6bd"/>`;
        }
      }
    }
    // RTG
    if (pw && pw.type === 'rtg') {
      const rx = bx - 26, ry = cy + bh / 2 - 6;
      back += `<line x1="${bx}" y1="${cy + bh / 2 - 10}" x2="${rx + 10}" y2="${ry + 4}" stroke="#c9d1e0" stroke-width="2"/>`;
      back += `<g transform="rotate(-35 ${rx} ${ry})"><rect x="${rx - 7}" y="${ry - 16}" width="14" height="32" rx="3" fill="#59606e" stroke="#9aa6bd"/>` +
        [...Array(6)].map((_, i) => `<rect x="${rx - 12}" y="${ry - 14 + i * 5.5}" width="24" height="1.6" fill="#7b8496"/>`).join('') + `<circle cx="${rx}" cy="${ry}" r="3" fill="#ff7a3d" opacity=".8"><animate attributeName="opacity" values=".4;.9;.4" dur="2s" repeatCount="indefinite"/></circle></g>`;
    }

    // IR telescope primary mirror above
    const hasTel = insts.includes('ir_tel');
    if (hasTel) {
      const hx = (q, r) => { const s = 9; return [cx + s * 1.5 * q, cy - bh / 2 - 46 + s * Math.sqrt(3) * (r + q / 2)]; };
      const cells = [[0, 0], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [2, -1], [-2, 1], [2, -2], [-2, 2], [1, 1], [-1, -1], [2, 0], [-2, 0]];
      let mirr = '';
      cells.forEach(([q, r]) => {
        if (q === 0 && r === 0) return;
        const [x, y] = hx(q, r); const pts = [...Array(6)].map((_, k) => { const a = Math.PI / 3 * k; return `${x + 8.6 * Math.cos(a)},${y + 8.6 * Math.sin(a)}`; }).join(' ');
        mirr += `<polygon points="${pts}" fill="url(#gold)" stroke="#8a6a1f" stroke-width="0.6"/>`;
      });
      top += `<line x1="${cx}" y1="${by}" x2="${cx}" y2="${cy - bh / 2 - 30}" stroke="#c9d1e0" stroke-width="3"/>${mirr}<circle cx="${cx}" cy="${cy - bh / 2 - 74}" r="3" fill="#ddd"/><line x1="${cx - 30}" y1="${cy - bh / 2 - 40}" x2="${cx}" y2="${cy - bh / 2 - 74}" stroke="#aab" stroke-width="0.8"/><line x1="${cx + 30}" y1="${cy - bh / 2 - 40}" x2="${cx}" y2="${cy - bh / 2 - 74}" stroke="#aab" stroke-width="0.8"/>`;
    }

    // bus body
    const isCube = bus === 'cube';
    const fill = isCube ? 'url(#alu)' : 'url(#gold)';
    let busSvg = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="${fill}" stroke="${isCube ? '#9aa6bd' : '#8a6a1f'}" stroke-width="1.2"/>`;
    if (!isCube) busSvg += `<path d="M${bx + 4} ${by + 6} q ${bw / 3} 6 ${bw - 8} -2 M${bx + 4} ${by + bh - 10} q ${bw / 2} -8 ${bw - 8} 3" stroke="#f6dc8c" stroke-width="0.8" fill="none" opacity=".7"/>`;
    if (isCube) for (let i = 1; i < 3; i++) busSvg += `<line x1="${bx}" y1="${by + i * bh / 3}" x2="${bx + bw}" y2="${by + i * bh / 3}" stroke="#7c8799" stroke-width="0.6"/>`;
    if (pw && pw.id === 'body') { busSvg += panel(bx + 3, by + 3, bw - 6, bh * 0.45); }

    // instruments on the front face
    const colors = ['#5ce1e6', '#ff8f6b', '#9b8cff', '#7ee787', '#ffd166', '#ff6bcb'];
    const shown = insts.filter(i => i !== 'ir_tel');
    shown.forEach((id, i) => {
      const cols = Math.min(3, shown.length), rows = Math.ceil(shown.length / 3);
      const w = Math.min(22, (bw - 10) / cols - 3), h = Math.min(16, (bh * 0.45) / rows - 2);
      const col = i % 3, row = Math.floor(i / 3);
      const x = bx + 5 + col * (w + 3), y = by + bh - 6 - (rows - row) * (h + 2);
      const label = G.get.inst(id).name.split(/[\s-]+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
      busSvg += `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#141b2d" stroke="${colors[i % 6]}" stroke-width="1.2"/><circle cx="${x + w / 2}" cy="${y + h / 2 - 1}" r="${Math.min(w, h) / 4}" fill="${colors[i % 6]}" opacity=".35"/><text x="${x + w / 2}" y="${y + h / 2 + 2.5}" font-size="6.5" text-anchor="middle" fill="${colors[i % 6]}" font-family="monospace">${label}</text></g>`;
    });

    // comms hardware on top
    const topY = by;
    if (comms === 'uhf') top += `<line x1="${bx + 4}" y1="${topY}" x2="${bx - 14}" y2="${topY - 22}" stroke="#ddd" stroke-width="1"/><line x1="${bx + bw - 4}" y1="${topY}" x2="${bx + bw + 14}" y2="${topY - 22}" stroke="#ddd" stroke-width="1"/>`;
    if (comms === 'sband') top += `<rect x="${cx + bw / 4 - 6}" y="${topY - 6}" width="12" height="6" fill="#d9dee8"/><line x1="${cx + bw / 4}" y1="${topY - 6}" x2="${cx + bw / 4}" y2="${topY - 18}" stroke="#ddd" stroke-width="1.4"/>`;
    const dish = (r, col) => `<line x1="${cx + (hasTel ? bw / 3 : 0)}" y1="${topY}" x2="${cx + (hasTel ? bw / 3 : 0)}" y2="${topY - 10}" stroke="#c9d1e0" stroke-width="2"/><ellipse cx="${cx + (hasTel ? bw / 3 : 0)}" cy="${topY - 10 - r * 0.35}" rx="${r}" ry="${r * 0.35}" fill="${col}" stroke="#7d8799"/><line x1="${cx + (hasTel ? bw / 3 : 0)}" y1="${topY - 10 - r * 0.35}" x2="${cx + (hasTel ? bw / 3 : 0)}" y2="${topY - 14 - r * 0.8}" stroke="#aab" stroke-width="1"/>`;
    if (comms === 'xband') top += dish(10, '#eef1f6');
    if (comms === 'hga') top += dish(28, '#f4f6fa');
    if (comms === 'ka') top += dish(18, '#ffe7a3');
    if (comms === 'laser') top += `<rect x="${cx - 5}" y="${topY - 16}" width="10" height="16" rx="2" fill="#3a4258" stroke="#9aa6bd"/><circle cx="${cx}" cy="${topY - 16}" r="4" fill="#7ee787"><animate attributeName="opacity" values=".3;1;.3" dur="1.4s" repeatCount="indefinite"/></circle>`;

    // star trackers
    if (adcs === 'star' || adcs === 'fine') top += `<rect x="${bx + bw - 10}" y="${by - 7}" width="6" height="8" fill="#222a3d" stroke="#9aa6bd"/><rect x="${bx + 4}" y="${by - 7}" width="6" height="8" fill="#222a3d" stroke="#9aa6bd"/>`;
    if (insts.includes('magnetometer')) top += `<line x1="${bx + bw}" y1="${by + 8}" x2="${bx + bw + 36}" y2="${by - 18}" stroke="#c9d1e0" stroke-width="1.2"/><circle cx="${bx + bw + 36}" cy="${by - 18}" r="2.5" fill="#ffd166"/>`;

    // propulsion
    if (prop && prop !== 'none') {
      const nw = { cold: 6, mono: 10, biprop: 16, ion: 14 }[prop] || 8;
      bottom += `<polygon points="${cx - nw / 3},${by + bh} ${cx + nw / 3},${by + bh} ${cx + nw / 2},${by + bh + nw * 0.9} ${cx - nw / 2},${by + bh + nw * 0.9}" fill="#4b5366" stroke="#9aa6bd"/>`;
      if (prop === 'ion') bottom += `<ellipse cx="${cx}" cy="${by + bh + nw + 6}" rx="5" ry="10" fill="#6fb7ff" opacity=".55"><animate attributeName="opacity" values=".2;.7;.2" dur="1.2s" repeatCount="indefinite"/></ellipse>`;
    }

    const empty = !bus;
    return `<svg viewBox="0 0 320 220" class="craft" role="img" aria-label="Spacecraft preview">
      <defs>
        <linearGradient id="gold" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#f6d77a"/><stop offset=".5" stop-color="#d4a843"/><stop offset="1" stop-color="#a77d26"/></linearGradient>
        <linearGradient id="alu" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#e8ecf3"/><stop offset="1" stop-color="#9aa3b5"/></linearGradient>
        <linearGradient id="cell" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#2a4fa8"/><stop offset="1" stop-color="#16295e"/></linearGradient>
      </defs>
      <g class="${empty ? 'craft-empty' : 'float'}">${back}${busSvg}${top}${bottom}${front}</g>
      ${empty ? '<text x="160" y="200" text-anchor="middle" fill="#7f8aa3" font-size="11">Choose a bus to start building</text>' : ''}
    </svg>`;
  }

  // ---------------- orbit diagrams ----------------
  function orbit(id, opts = {}) {
    const w = 320, h = 180, big = opts.big;
    const dot = (path, dur) => `<circle r="${big ? 4 : 3.2}" fill="#ffd166" stroke="#fff" stroke-width="1"><animateMotion dur="${dur}s" repeatCount="indefinite" path="${path}"/></circle>`;
    const stars = [...Array(40)].map((_, i) => `<circle cx="${(i * 73) % w}" cy="${(i * 41) % h}" r="${i % 5 === 0 ? 1 : 0.5}" fill="#fff" opacity="${0.2 + (i % 4) * 0.15}"/>`).join('');
    const earth = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#earthg)"/><path d="M${x - r * 0.5} ${y - r * 0.3} q ${r * 0.3} -${r * 0.4} ${r * 0.6} 0 t ${r * 0.4} ${r * 0.5}" stroke="#7ee787" stroke-width="${r / 6}" fill="none" opacity=".6"/>`;
    const defs = `<defs><radialGradient id="earthg" cx=".35" cy=".35"><stop offset="0" stop-color="#6fb7ff"/><stop offset="1" stop-color="#1b4fa0"/></radialGradient>
      <radialGradient id="sung" cx=".5" cy=".5"><stop offset="0" stop-color="#fff6c2"/><stop offset=".6" stop-color="#ffc247"/><stop offset="1" stop-color="#ff8a00" stop-opacity="0"/></radialGradient>
      <radialGradient id="moong" cx=".35" cy=".35"><stop offset="0" stop-color="#e6e6e6"/><stop offset="1" stop-color="#8d8d8d"/></radialGradient>
      <radialGradient id="marsg" cx=".35" cy=".35"><stop offset="0" stop-color="#ff9a6b"/><stop offset="1" stop-color="#a8381a"/></radialGradient></defs>`;
    let body = '';
    const label = (x, y, t, a = 'middle') => `<text x="${x}" y="${y}" fill="#aab4c8" font-size="10" text-anchor="${a}">${t}</text>`;
    switch (id) {
      case 'leo': { const p = 'M110,90 a50,50 0 1,0 100,0 a50,50 0 1,0 -100,0'; body = `${earth(160, 90, 40)}<path d="${p}" stroke="#ffd166" stroke-dasharray="3 3" fill="none" opacity=".7"/>${dot(p, 4)}${label(160, 170, 'LEO · 500 km · 95 min orbit')}`; break; }
      case 'sso': { const p = 'M160,30 a24,60 0 1,0 0.1,0'; body = `${earth(160, 90, 40)}<path d="M160,30 a24,60 0 1,0 0.1,0" stroke="#ffd166" stroke-dasharray="3 3" fill="none" opacity=".7" transform="rotate(8 160 90)"/><g transform="rotate(8 160 90)">${dot(p, 4)}</g>${label(160, 170, 'Sun-synchronous · near-polar · 700 km')}`; break; }
      case 'geo': { const p = 'M70,90 a90,70 0 1,0 180,0 a90,70 0 1,0 -180,0'; body = `${earth(160, 90, 22)}<path d="${p}" stroke="#ffd166" stroke-dasharray="3 3" fill="none" opacity=".7"/>${dot(p, 12)}${label(160, 172, 'GEO · 35,786 km · 24 h orbit')}`; break; }
      case 'l1': case 'l2': {
        const lx = id === 'l1' ? 200 : 290;
        body = `<circle cx="20" cy="90" r="34" fill="url(#sung)"/>${label(20, 145, 'Sun')}${earth(250, 90, 9)}${label(250, 115, 'Earth')}
          <circle cx="200" cy="90" r="2" fill="#aab4c8"/>${label(200, 70, 'L1')}<circle cx="290" cy="90" r="2" fill="#aab4c8"/>${label(290, 70, 'L2')}
          <line x1="40" y1="90" x2="300" y2="90" stroke="#34405a" stroke-dasharray="2 4"/>
          <ellipse cx="${lx}" cy="90" rx="7" ry="16" stroke="#ffd166" stroke-dasharray="2 2" fill="none" opacity=".8"/>
          ${dot(`M${lx},74 a7,16 0 1,0 0.1,0`, 6)}${label(160, 170, id === 'l1' ? 'L1 · 1.5 million km toward the Sun' : 'L2 · 1.5 million km away from the Sun')}`; break; }
      case 'moon': { const p = 'M240,52 a22,38 0 1,0 0.1,0'; body = `${earth(50, 90, 18)}${label(50, 125, 'Earth')}<path d="M68,90 C120,40 190,40 222,80" stroke="#34405a" stroke-dasharray="3 4" fill="none"/><circle cx="240" cy="90" r="30" fill="url(#moong)"/><circle cx="232" cy="78" r="4" fill="#7a7a7a" opacity=".6"/><circle cx="250" cy="100" r="6" fill="#7a7a7a" opacity=".5"/><path d="${p}" stroke="#ffd166" stroke-dasharray="3 3" fill="none" opacity=".8"/>${dot(p, 4)}${label(160, 170, 'Polar lunar orbit · over both poles')}`; break; }
      case 'mars': { const p = 'M248,58 a34,34 0 1,0 0.1,0'; body = `<circle cx="40" cy="160" r="20" fill="url(#sung)"/>${earth(70, 40, 9)}${label(70, 25, 'Earth')}<path d="M78,44 C160,20 220,40 222,70" stroke="#34405a" stroke-dasharray="3 4" fill="none"/>${label(150, 40, '7-month cruise')}<circle cx="248" cy="92" r="26" fill="url(#marsg)"/><path d="${p}" stroke="#ffd166" stroke-dasharray="3 3" fill="none" opacity=".8"/>${dot(p, 4)}${label(248, 145, 'Mars orbit')}`; break; }
      default: body = `${label(160, 95, 'Choose an orbit')}`;
    }
    return `<svg viewBox="0 0 ${w} ${h}" class="orbitsvg">${defs}${stars}${body}</svg>`;
  }

  function rocket() {
    return `<svg viewBox="0 0 120 220" class="rocket"><g class="rocket-body"><path d="M60 10 C72 30 76 60 76 120 L44 120 C44 60 48 30 60 10Z" fill="#e8ecf3" stroke="#9aa6bd"/><circle cx="60" cy="60" r="7" fill="#1b4fa0" stroke="#9aa6bd"/><path d="M44 100 L30 132 L44 124Z M76 100 L90 132 L76 124Z" fill="#c43c3c"/><rect x="50" y="120" width="20" height="8" fill="#59606e"/><path d="M50 128 Q60 190 70 128Z" fill="#ffb547"><animate attributeName="d" values="M50 128 Q60 190 70 128Z;M50 128 Q60 210 70 128Z;M50 128 Q60 190 70 128Z" dur=".25s" repeatCount="indefinite"/></path><path d="M54 128 Q60 165 66 128Z" fill="#fff6c2"/></g></svg>`;
  }

  return { craft, orbit, rocket };
})();
