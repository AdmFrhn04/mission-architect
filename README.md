# Mission Architect — Design. Launch. Discover.

A browser game for the **NASA Space Apps Challenge 2026 — Space Mission Design Game** challenge.
1–4 players design, launch and operate a complete space mission, balancing budget, mass, power,
battery, data, delta-v and pointing, then fly it through random events and read a post-mission report.

**Play:** open `index.html` in any modern browser (no install, works offline).

## Features
- 5 scenarios (Earth wildfires, lunar ice, solar storms at L1, Mars recon, infrared observatory at L2) + sandbox
- 3 difficulty levels (Cadet / Engineer / Flight Director)
- Engineering model: rocket equation, eclipse-aware solar + battery sizing, distance-dependent data rates,
  ground-station contact time, pointing, radiation, thermal, NASA risk classes, launcher capacity
- Team mode: Mission Director, Science Lead, Spacecraft Engineer, Flight Ops & Comms with conflicting goals,
  GO/NO-GO poll, voted in-flight decisions
- Flight simulation, scoring, post-mission analysis with real NASA mission comparisons
- Mission Handbook glossary, leaderboard (local), shareable design codes

## Project structure
- `index.html` — the complete game (built file)
- `src/logic.js` — game data, engineering model, simulation, scoring
- `src/visuals.js` — SVG spacecraft builder and orbit diagrams
- `src/app.js` — user interface
- `src/style.css`, `src/shell.html` — styling and page template
- `build.py` — inlines `src/` into `index.html` (`python3 build.py`, output in `dist/`)

## Deploy on GitHub Pages
1. Create a public repo and upload these files.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / root.
3. Your game is live at `https://<username>.github.io/<repo>/`.

## NASA resources used
Design and Develop Science Missions (mission segments), JPL Concept Maturity Levels and the Mission Design Lab
(trade-study approach), CubeSat 101, GMAT (orbit and delta-v concepts), NASA's telescope learning game,
and public facts about MODIS/VIIRS, Landsat, ECOSTRESS, Lunar Prospector, LRO, ACE, SOHO, DSCOVR, MRO,
Mars Odyssey, JWST and the Deep Space Network. Partner: CSA Digital Games and Activities.

## AI disclosure
The code, game balance numbers and explanatory text were drafted with the help of Claude (Anthropic),
an AI assistant, and reviewed and edited by the team. <!-- Describe your team's own decisions and changes here. -->
No AI-generated images or audio are used. All graphics are SVG drawn in code. No NASA logos or branding are used.

## Credits
Fonts: Space Grotesk, JetBrains Mono (Google Fonts, SIL OFL).
