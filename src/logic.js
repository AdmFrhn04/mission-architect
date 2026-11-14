/* ==========================================================================
   MISSION ARCHITECT — game data + engineering model + simulation engine
   Pure logic, no DOM. Values are simplified for play but grounded in
   real mission-design relationships (rocket equation, eclipse power
   sizing, link rate vs. distance, NASA risk classes, etc.).
   ========================================================================== */
const GAME = (() => {
  const G0 = 9.80665;

  // ---------- ROLES ----------
  const ROLES = {
    director: { id: 'director', name: 'Mission Director', icon: '🎯', color: '#ffb547',
      owns: 'Mission goals, budget, risk class & launch vehicle',
      goal: 'Finish with at least 10% of the budget held in reserve and a successful mission.' },
    science: { id: 'science', name: 'Science Lead', icon: '🔬', color: '#5ce1e6',
      owns: 'Scientific instruments',
      goal: 'Return at least 100% of the science target.' },
    engineer: { id: 'engineer', name: 'Spacecraft Engineer', icon: '🛠️', color: '#9b8cff',
      owns: 'Spacecraft bus, power, attitude control, computer, propulsion, thermal',
      goal: 'Launch with at least 20% power margin and 15% launch-mass margin.' },
    flightops: { id: 'flightops', name: 'Flight Ops & Comms', icon: '📡', color: '#7ee787',
      owns: 'Orbit, communications & ground stations',
      goal: 'Downlink at least 150% of the data produced and meet the end-of-life disposal plan.' },
  };
  const ROLE_ORDER = ['director', 'science', 'engineer', 'flightops'];

  // ---------- DIFFICULTY ----------
  const DIFFICULTY = {
    cadet: { id: 'cadet', name: 'Cadet', budgetMult: 1.3, hazardMult: 0.5, launchSafe: true, events: 2,
      desc: '30% extra budget, gentler events, no launch failures, hints switched on.' },
    engineer: { id: 'engineer', name: 'Engineer', budgetMult: 1.0, hazardMult: 1.0, launchSafe: false, events: 3,
      desc: 'Realistic budget and risks. Launches can fail at the rocket\'s real-world rate.' },
    director: { id: 'director', name: 'Flight Director', budgetMult: 0.9, hazardMult: 1.4, launchSafe: false, events: 4,
      desc: '10% less budget, harsher space environment, more surprises.' },
  };

  // ---------- RISK CLASSES (NASA NPR 8705.4 style) ----------
  const RISK = [
    { id: 'D', name: 'Class D — Low cost, higher risk', costMult: 1.0, massMult: 1.0, hazMult: 1.6, redundancy: false,
      learn: 'Single-string design: no backups. Common for CubeSats and tech demos. Cheapest, but one failure can end the mission.' },
    { id: 'C', name: 'Class C — Balanced', costMult: 1.1, massMult: 1.05, hazMult: 1.0, redundancy: false,
      learn: 'Selective testing and some backups. Used by many small science missions.' },
    { id: 'B', name: 'Class B — High priority', costMult: 1.3, massMult: 1.12, hazMult: 0.5, redundancy: true,
      learn: 'Redundant (backup) critical systems and extensive testing. Typical for major science missions.' },
    { id: 'A', name: 'Class A — Flagship', costMult: 1.6, massMult: 1.2, hazMult: 0.25, redundancy: true,
      learn: 'Maximum redundancy and testing, for irreplaceable flagships like the James Webb Space Telescope.' },
  ];

  // ---------- ORBITS ----------
  // dist: link distance class used by comms + ground tables
  const ORBITS = [
    { id: 'leo', name: 'Low Earth Orbit', short: 'LEO · 500 km', dist: 'near', body: 'earth',
      eclipseMin: 36, periodMin: 95, solar: 1.0, radiation: 1, thermal: 1, dvInsert: 0, dvYear: 25, dvDispose: 0,
      transitDays: 0, dod: 0.3, stationKeepLimitsLife: false,
      learn: 'Closest to Earth: sharp images and fast downlinks, cheapest to reach. Orbits every ~95 minutes and spends ~36 of them in Earth\'s shadow. Thin atmosphere drags the orbit down, so at 500 km a dead satellite naturally re-enters within a few years.' },
    { id: 'sso', name: 'Sun-Synchronous Orbit', short: 'SSO · 700 km', dist: 'near', body: 'earth',
      eclipseMin: 34, periodMin: 99, solar: 1.0, radiation: 1, thermal: 1, dvInsert: 0, dvYear: 10, dvDispose: 120,
      transitDays: 0, dod: 0.3, stationKeepLimitsLife: false,
      learn: 'A near-polar orbit that passes over each place at the same local time every day — ideal for comparing images over time. At 700 km drag is weak, so you need propellant to de-orbit at end of life or the satellite becomes long-lived debris.' },
    { id: 'geo', name: 'Geostationary Orbit', short: 'GEO · 35,786 km', dist: 'geo', body: 'earth',
      eclipseMin: 72, periodMin: 1436, solar: 1.0, radiation: 3, thermal: 1, dvInsert: 0, dvYear: 50, dvDispose: 12,
      transitDays: 1, dod: 0.7, stationKeepLimitsLife: true,
      learn: 'Orbits once per day, so it hovers over one spot: constant view of a whole hemisphere and 24-hour contact with a ground station, but 70× farther than LEO (blurrier images, weaker signal). Harsh radiation from the outer Van Allen belt. Needs station-keeping fuel every year.' },
    { id: 'l1', name: 'Sun–Earth L1', short: 'L1 · 1.5 million km sunward', dist: 'deep', body: 'l1',
      eclipseMin: 0, periodMin: 1, solar: 1.0, radiation: 2, thermal: 1, dvInsert: 30, dvYear: 10, dvDispose: 0,
      transitDays: 100, dod: 0.7, stationKeepLimitsLife: true,
      learn: 'A balance point between the Sun and Earth. A spacecraft here sees the solar wind about an hour before it reaches Earth — perfect for space-weather warnings. Never in shadow. Needs the Deep Space Network to talk home.' },
    { id: 'l2', name: 'Sun–Earth L2', short: 'L2 · 1.5 million km anti-sunward', dist: 'deep', body: 'l2',
      eclipseMin: 0, periodMin: 1, solar: 1.0, radiation: 2, thermal: 1, dvInsert: 30, dvYear: 4, dvDispose: 0,
      transitDays: 30, dod: 0.7, stationKeepLimitsLife: true,
      learn: 'Behind Earth as seen from the Sun. Sun, Earth and Moon all sit in one direction, so one sunshield can block their heat — that\'s why cold infrared telescopes like JWST live here.' },
    { id: 'moon', name: 'Low Lunar Polar Orbit', short: 'Moon · 50 km polar', dist: 'moon', body: 'moon',
      eclipseMin: 47, periodMin: 118, solar: 1.0, radiation: 2, thermal: 2, dvInsert: 800, dvYear: 100, dvDispose: 0,
      transitDays: 5, dod: 0.5, stationKeepLimitsLife: true,
      learn: 'Passes over both lunar poles where water ice may hide in shadowed craters. Requires a big braking burn (~800 m/s) to be captured, and the Moon\'s lumpy gravity keeps pulling low orbits down, costing fuel every year. Extreme surface heat swings.' },
    { id: 'mars', name: 'Mars Science Orbit', short: 'Mars · 300 km', dist: 'mars', body: 'mars',
      eclipseMin: 40, periodMin: 112, solar: 0.43, radiation: 2, thermal: 2, dvInsert: 1000, dvYear: 10, dvDispose: 0,
      transitDays: 210, dod: 0.5, stationKeepLimitsLife: true,
      learn: 'Mars gets only 43% of the sunlight Earth does, so solar arrays must be much bigger. Seven-month cruise, a ~1 km/s orbit-insertion burn, and up to 20 light-minutes of signal delay — downlink is the classic Mars bottleneck.' },
  ];

  // ---------- LAUNCH VEHICLES (capacity kg to each orbit) ----------
  const LAUNCHERS = [
    { id: 'rideshare', name: 'Rideshare slot', example: 'shared ride on a larger rocket', cost: 6, reliability: 0.97,
      cap: { leo: 300, sso: 300 }, maxBus: 'small',
      learn: 'Your spacecraft shares a rocket with others. Very cheap, but you go where the main customer goes (LEO/SSO only) and size is limited.' },
    { id: 'small', name: 'Small launcher', example: 'Electron-class', cost: 9, reliability: 0.92,
      cap: { leo: 450, sso: 300, moon: 40, l1: 40, l2: 40 }, maxBus: 'small',
      learn: 'Dedicated small rocket: you choose the orbit and launch date. Lower track record. With a kick stage it can fling a tiny probe to the Moon.' },
    { id: 'medium', name: 'Medium launcher', example: 'Falcon 9-class', cost: 70, reliability: 0.98,
      cap: { leo: 17000, sso: 12000, geo: 2000, l1: 3500, l2: 3500, moon: 3000, mars: 1800 },
      learn: 'Workhorse rocket with an excellent record. Can send moderate spacecraft almost anywhere.' },
    { id: 'heavy', name: 'Heavy launcher', example: 'Falcon Heavy / Ariane 5-class', cost: 150, reliability: 0.96,
      cap: { leo: 60000, sso: 40000, geo: 8000, l1: 15000, l2: 15000, moon: 12000, mars: 12000 },
      learn: 'For large or far-flung missions: big observatories, outer-planet probes, heavy Mars orbiters.' },
    { id: 'superheavy', name: 'Super-heavy launcher', example: 'SLS-class', cost: 2000, reliability: 0.95,
      cap: { leo: 95000, sso: 70000, geo: 20000, l1: 30000, l2: 30000, moon: 27000, mars: 20000 },
      learn: 'Enormous capacity at an enormous price. Usually reserved for crewed exploration.' },
  ];

  // ---------- SPACECRAFT BUS ----------
  const BUSES = [
    { id: 'cube', name: 'CubeSat (12U)', mass: 12, cost: 3, payloadMass: 8, slots: 2, basePower: 8, opsYear: 0.5,
      maxPowerTier: 1, rtgOk: false, massMult: 0.15, powerMult: 0.3, costMult: 0.3,
      learn: 'About the size of a carry-on bag. Very cheap and quick to build, but tiny room for instruments, power and fuel.' },
    { id: 'small', name: 'SmallSat (ESPA-class)', mass: 50, cost: 20, payloadMass: 80, slots: 3, basePower: 40, opsYear: 2,
      maxPowerTier: 2, rtgOk: false, massMult: 1, powerMult: 1, costMult: 1,
      learn: 'Mini-fridge sized, up to ~300 kg total. The sweet spot for focused science missions.' },
    { id: 'medium', name: 'Medium spacecraft', mass: 450, cost: 70, payloadMass: 500, slots: 5, basePower: 120, opsYear: 8,
      maxPowerTier: 4, rtgOk: true, massMult: 3, powerMult: 2, costMult: 2,
      learn: 'Car-sized. Room for a full instrument suite, big solar arrays and plenty of fuel — e.g. a Mars orbiter.' },
    { id: 'large', name: 'Flagship spacecraft', mass: 1400, cost: 180, payloadMass: 2000, slots: 6, basePower: 300, opsYear: 25,
      maxPowerTier: 4, rtgOk: true, massMult: 6, powerMult: 3, costMult: 3,
      learn: 'Bus-sized observatory class. Carries the largest instruments and telescopes; also the most expensive to operate.' },
  ];

  // ---------- POWER ----------
  const POWER = [
    { id: 'body', name: 'Body-mounted solar cells', type: 'solar', watts: 40, mass: 2, cost: 0.5, tier: 0,
      learn: 'Cells glued to the spacecraft\'s sides. Simple, no moving parts, little power.' },
    { id: 'deploy', name: 'Deployable solar panels', type: 'solar', watts: 150, mass: 8, cost: 2, tier: 1,
      learn: 'Panels that unfold after launch. Much more area — but deployments are a classic failure point.' },
    { id: 'wings', name: 'Solar array wings', type: 'solar', watts: 800, mass: 35, cost: 8, tier: 2,
      learn: 'Two rotating wings that track the Sun.' },
    { id: 'largewings', name: 'Large solar wings', type: 'solar', watts: 3000, mass: 110, cost: 25, tier: 3,
      learn: 'Big multi-panel wings for power-hungry payloads.' },
    { id: 'huge', name: 'Roll-out solar arrays (ROSA)', type: 'solar', watts: 8000, mass: 250, cost: 55, tier: 4,
      learn: 'Huge flexible arrays that unroll like a carpet. Used where sunlight is weak or demand is high.' },
    { id: 'rtg', name: 'Radioisotope generator (MMRTG)', type: 'rtg', watts: 110, mass: 45, cost: 90, tier: 2,
      learn: 'Turns heat from decaying plutonium into ~110 W, day and night, regardless of sunlight. Very expensive and scarce; powers rovers like Curiosity and Perseverance.' },
  ];
  const SOLAR_DEGRADE = 0.025, RTG_DEGRADE = 0.03, CHARGE_EFF = 0.85;

  const BATTERIES = [
    { id: 'b50', name: 'Mini Li-ion pack', wh: 50, mass: 0.4, cost: 0.2 },
    { id: 'b300', name: 'Small Li-ion battery', wh: 300, mass: 2.5, cost: 1 },
    { id: 'b1500', name: 'Medium Li-ion battery', wh: 1500, mass: 11, cost: 3 },
    { id: 'b6000', name: 'Large Li-ion battery', wh: 6000, mass: 42, cost: 8 },
    { id: 'b20000', name: 'Very large battery bank', wh: 20000, mass: 140, cost: 20 },
  ];

  // ---------- COMMS (data rate Mbps by distance class) ----------
  const COMMS = [
    { id: 'uhf', name: 'UHF radio', mass: 1, power: 4, cost: 0.3, pointing: 30, risky: false,
      rate: { near: 0.01, geo: 0, moon: 0, deep: 0, mars: 0 },
      learn: 'Simple omnidirectional radio (~10 kbps). Works only close to Earth. Fine for telemetry, hopeless for images.' },
    { id: 'sband', name: 'S-band transceiver', mass: 4, power: 15, cost: 2, pointing: 30, risky: false,
      rate: { near: 2, geo: 0.5, moon: 0.2, deep: 0.05, mars: 0.002 },
      learn: 'Reliable workhorse radio for commands and modest data.' },
    { id: 'xband', name: 'X-band (medium-gain antenna)', mass: 12, power: 40, cost: 8, pointing: 1, risky: false,
      rate: { near: 150, geo: 20, moon: 10, deep: 2, mars: 0.2 },
      learn: 'Higher frequency, more focused beam: much faster, but must be pointed.' },
    { id: 'hga', name: 'X-band high-gain dish (3 m)', mass: 60, power: 100, cost: 25, pointing: 0.1, risky: false,
      rate: { near: 300, geo: 60, moon: 40, deep: 10, mars: 6 },
      learn: 'A big dish concentrates the signal into a tight beam — the standard for deep space. Heavy and needs precise pointing.' },
    { id: 'ka', name: 'Ka-band high-rate system', mass: 25, power: 80, cost: 20, pointing: 0.1, risky: false,
      rate: { near: 800, geo: 200, moon: 100, deep: 28, mars: 12 },
      learn: 'Even higher frequency → more data (JWST downlinks ~28 Mbps over Ka-band). Rain on Earth can interrupt it.' },
    { id: 'laser', name: 'Optical laser terminal (experimental)', mass: 30, power: 120, cost: 35, pointing: 0.01, risky: true,
      rate: { near: 1200, geo: 1200, moon: 620, deep: 60, mars: 25 },
      learn: 'Uses light instead of radio — 10–100× faster (NASA demos: 622 Mbps from the Moon). Clouds block it and the technology is still young.' },
  ];

  // ---------- GROUND NETWORK (contact hours/day by distance class; $M/yr) ----------
  const GROUND = [
    { id: 'uni', name: 'University ground station', costYear: 0.3,
      hours: { near: 0.5, geo: 24, moon: 0, deep: 0, mars: 0 },
      learn: 'One small dish. A low-orbit satellite is overhead only a few minutes per pass, ~30 min/day.' },
    { id: 'commercial', name: 'Commercial global network', costYear: 2,
      hours: { near: 3, geo: 24, moon: 8, deep: 0, mars: 0 },
      learn: 'Pay-per-pass antennas around the world (including polar sites) → many more contacts per day.' },
    { id: 'nsn', name: 'NASA Near Space Network', costYear: 4,
      hours: { near: 6, geo: 24, moon: 12, deep: 0, mars: 0 },
      learn: 'NASA\'s network of ground stations and relay satellites for Earth orbit and the Moon.' },
    { id: 'dsn', name: 'Deep Space Network (DSN)', costYear: 5,
      hours: { near: 0, geo: 0, moon: 16, deep: 8, mars: 8 },
      learn: 'Giant 34–70 m dishes in California, Spain and Australia, spaced so one always faces deep space. The only way to hear faint signals from L1/L2 or Mars. Time on it is shared by many missions.' },
  ];

  // ---------- ADCS ----------
  const ADCS = [
    { id: 'mtq', name: 'Magnetorquers + magnetometer', pointing: 2, mass: 1, power: 2, cost: 0.5, earthOnly: true, wheels: false,
      learn: 'Coils push against Earth\'s magnetic field. Cheap and simple, but coarse — and useless away from Earth.' },
    { id: 'rw', name: 'Reaction wheels + Sun sensors', pointing: 0.1, mass: 10, power: 20, cost: 4, earthOnly: false, wheels: true,
      learn: 'Spinning wheels twist the spacecraft (Newton\'s 3rd law). Good to ~0.1°.' },
    { id: 'star', name: 'Star trackers + reaction wheels', pointing: 0.01, mass: 15, power: 30, cost: 10, earthOnly: false, wheels: true,
      learn: 'Cameras recognise star patterns to know orientation precisely (~0.01°).' },
    { id: 'fine', name: 'Fine guidance system', pointing: 0.001, mass: 25, power: 45, cost: 25, earthOnly: false, wheels: true,
      learn: 'Telescope-grade stability (~0.001° and better) using guide stars and ultra-quiet wheels.' },
  ];

  // ---------- COMPUTER ----------
  const COMPUTERS = [
    { id: 'cots', name: 'Commercial processor', radTol: 1, mass: 1, power: 5, cost: 0.5, reduction: 1,
      learn: 'Fast and cheap phone-class chip. Radiation can flip bits or latch it up.' },
    { id: 'radtol', name: 'Radiation-tolerant computer', radTol: 2, mass: 4, power: 12, cost: 4, reduction: 1,
      learn: 'Shielded and error-correcting. Handles most environments.' },
    { id: 'radhard', name: 'Radiation-hardened (RAD750-class)', radTol: 3, mass: 6, power: 15, cost: 10, reduction: 1,
      learn: 'Built for the harshest radiation. Slow by modern standards — but it does not crash.' },
    { id: 'edge', name: 'High-performance + onboard AI', radTol: 2, mass: 5, power: 30, cost: 12, reduction: 0.5,
      learn: 'Processes data in orbit (compression, cloud filtering, event detection) and sends only what matters: halves your data volume.' },
  ];

  // ---------- PROPULSION ----------
  const PROPULSION = [
    { id: 'none', name: 'No propulsion', isp: 1, dry: 0, cost: 0, power: 0, maxDv: 0, slow: false,
      learn: 'Lightest and cheapest — but you can never change orbit, dodge debris, or de-orbit.' },
    { id: 'cold', name: 'Cold-gas thrusters', isp: 70, dry: 3, cost: 1, power: 0, maxDv: 60, slow: false,
      learn: 'Squirts pressurised gas. Very safe and simple, very weak (low specific impulse).' },
    { id: 'mono', name: 'Monopropellant (hydrazine)', isp: 225, dry: 15, cost: 6, power: 0, maxDv: 600, slow: false,
      learn: 'One propellant decomposed over a catalyst. Reliable choice for station-keeping and small manoeuvres.' },
    { id: 'biprop', name: 'Bipropellant engine', isp: 315, dry: 40, cost: 15, power: 0, maxDv: 2500, slow: false,
      learn: 'Fuel + oxidiser burned together. High thrust for big orbit-insertion burns at the Moon or Mars.' },
    { id: 'ion', name: 'Electric (ion) propulsion', isp: 3000, dry: 30, cost: 20, power: 800, maxDv: 5000, slow: true,
      learn: 'Accelerates ions with electricity: ~10× more efficient than chemical, but thrust is tiny, so transfers take months longer and it needs lots of power.' },
  ];

  // ---------- THERMAL ----------
  const THERMAL = [
    { id: 'passive', name: 'Passive (coatings + insulation)', level: 1, massFrac: 0.02, powerFrac: 0, mass: 0, power: 0, cost: 0.5,
      learn: 'Blankets and special paints balance heat in and out. Enough for most Earth orbits and L1/L2.' },
    { id: 'active', name: 'Active (heaters, radiators, heat pipes)', level: 2, massFrac: 0.05, powerFrac: 0.08, mass: 0, power: 0, cost: 3,
      learn: 'Heaters and loops keep electronics alive through extreme swings — needed around the Moon and Mars.' },
    { id: 'cryo', name: 'Sunshield + cryocooler', level: 3, massFrac: 0.05, powerFrac: 0.05, mass: 150, power: 200, cost: 60,
      learn: 'A multi-layer sunshield plus a refrigerator chills detectors below –230 °C. Required for infrared astronomy.' },
  ];

  // ---------- INSTRUMENTS ----------
  // pointing: required accuracy in degrees (smaller = harder)
  const INSTRUMENTS = [
    { id: 'thermal_ir', name: 'Thermal infrared camera', mass: 20, power: 40, cost: 15, data: 30, value: 25, pointing: 0.1, trl: 9,
      learn: 'Sees heat: active fires, surface temperatures, cold traps.' },
    { id: 'multispectral', name: 'Multispectral imager', mass: 15, power: 30, cost: 10, data: 40, value: 20, pointing: 0.1, trl: 9,
      learn: 'Images in several colour bands (like Landsat) to map vegetation, burn scars, minerals.' },
    { id: 'hyperspectral', name: 'Imaging spectrometer', mass: 40, power: 60, cost: 35, data: 200, value: 30, pointing: 0.1, trl: 8,
      learn: 'Splits light into hundreds of colours to identify minerals and chemistry — huge data volumes.' },
    { id: 'highres', name: 'High-resolution camera', mass: 60, power: 80, cost: 40, data: 150, value: 30, pointing: 0.01, trl: 9,
      learn: 'Telescope-camera that resolves details under a metre. Needs precise pointing.' },
    { id: 'sar', name: 'Radar (SAR / sounder)', mass: 120, power: 250, cost: 60, data: 250, value: 40, pointing: 0.1, trl: 8,
      learn: 'Makes its own microwaves — sees through clouds, smoke and darkness, and can probe below the surface for ice.' },
    { id: 'neutron', name: 'Neutron spectrometer', mass: 10, power: 12, cost: 8, data: 0.5, value: 25, pointing: 5, trl: 9,
      learn: 'Counts neutrons bouncing off the surface. Hydrogen (water ice!) absorbs them, revealing buried ice.' },
    { id: 'lidar_alt', name: 'Laser altimeter', mass: 20, power: 35, cost: 15, data: 5, value: 20, pointing: 0.1, trl: 9,
      learn: 'Times laser pulses to the ground to build precise 3-D topography maps.' },
    { id: 'magnetometer', name: 'Magnetometer', mass: 3, power: 5, cost: 3, data: 0.2, value: 12, pointing: 5, trl: 9,
      learn: 'Measures magnetic fields (solar wind, planetary fields). Usually on a boom away from spacecraft noise.' },
    { id: 'plasma', name: 'Solar wind plasma analyzer', mass: 8, power: 10, cost: 6, data: 1, value: 22, pointing: 5, trl: 9,
      learn: 'Measures speed, density and temperature of solar-wind particles streaming past.' },
    { id: 'coronagraph', name: 'Coronagraph', mass: 30, power: 30, cost: 25, data: 20, value: 30, pointing: 0.01, trl: 8,
      learn: 'Blocks the Sun\'s disk to see the faint corona and spot eruptions (CMEs) heading our way.' },
    { id: 'euv', name: 'Extreme-UV solar imager', mass: 25, power: 40, cost: 28, data: 60, value: 28, pointing: 0.01, trl: 8,
      learn: 'Images the hot solar atmosphere to catch flares as they erupt.' },
    { id: 'ir_tel', name: 'Infrared space telescope (2 m)', mass: 600, power: 300, cost: 350, data: 400, value: 90, pointing: 0.001, trl: 7, needsCryo: true,
      learn: 'Collects ancient, red-shifted light from the first galaxies. Must be kept extremely cold or it is blinded by its own heat.' },
    { id: 'nir_spec', name: 'Near-infrared spectrograph', mass: 60, power: 60, cost: 80, data: 100, value: 35, pointing: 0.001, trl: 7, needsCryo: true, requires: 'ir_tel',
      learn: 'Spreads telescope light into spectra to measure distance, age and chemistry of galaxies. Only works behind a telescope.' },
    { id: 'rad_mon', name: 'Radiation monitor', mass: 2, power: 3, cost: 1, data: 0.1, value: 8, pointing: 30, trl: 9,
      learn: 'Small detector measuring the local radiation environment — useful for future astronauts.' },
    { id: 'cube_cam', name: 'CubeSat camera', mass: 1, power: 5, cost: 0.5, data: 2, value: 6, pointing: 2, trl: 9,
      learn: 'Tiny off-the-shelf camera. Low resolution, but great for outreach pictures.' },
  ];

  // ---------- SCENARIOS ----------
  const SCENARIOS = [
    { id: 'wildfire', name: 'Wildfire Watch', body: 'Earth', level: 'Beginner', budget: 120, years: 3, icon: '🔥',
      blurb: 'Wildfires are growing more frequent. Build a satellite that spots fires every day and maps the damage they leave.',
      orbitFit: { sso: 1, leo: 0.85, geo: 0.6 },
      instFit: { thermal_ir: 1, multispectral: 1, hyperspectral: 0.8, highres: 0.6, sar: 0.7, cube_cam: 0.5, lidar_alt: 0.3, rad_mon: 0.1 },
      primary: { text: 'Detect active fires every day', anyOf: ['thermal_ir'], why: 'Fires are hot — a thermal infrared camera sees them even through thin smoke.' },
      secondary: [
        { text: 'Map burn scars and vegetation recovery', anyOf: ['multispectral', 'hyperspectral', 'highres'] },
        { text: 'See through thick smoke and clouds', anyOf: ['sar'] },
      ],
      sciTarget: 45,
      real: 'NASA\'s MODIS (Terra & Aqua) and VIIRS instruments detect active fires daily from polar orbits; Landsat maps burn scars; ECOSTRESS measures heat from the ISS.' },
    { id: 'lunar', name: 'Lunar Ice Hunter', body: 'Moon', level: 'Intermediate', budget: 250, years: 2, icon: '🌙',
      blurb: 'Future astronauts need water. Find ice hidden in the permanently shadowed craters at the Moon\'s poles and map safe landing zones.',
      orbitFit: { moon: 1 },
      instFit: { neutron: 1, sar: 1, lidar_alt: 1, multispectral: 0.8, thermal_ir: 0.8, hyperspectral: 0.9, highres: 0.7, cube_cam: 0.5, rad_mon: 0.4, magnetometer: 0.2 },
      primary: { text: 'Detect water ice in polar craters', anyOf: ['neutron', 'sar', 'hyperspectral'], why: 'Neutron spectrometers sense hydrogen; radar and spectrometers can spot ice signatures.' },
      secondary: [
        { text: 'Map polar terrain for future landings', anyOf: ['lidar_alt', 'highres'] },
        { text: 'Measure how cold the crater floors are', anyOf: ['thermal_ir'] },
      ],
      sciTarget: 60,
      real: 'Lunar Prospector (1998) found hydrogen at the poles with a neutron spectrometer; LRO\'s LOLA altimeter and Diviner radiometer mapped polar terrain and cold traps; India\'s Chandrayaan-1 carried NASA\'s M3 spectrometer, which detected water.' },
    { id: 'solar', name: 'Solar Storm Sentinel', body: 'Sun–Earth L1', level: 'Intermediate', budget: 250, years: 5, icon: '☀️',
      blurb: 'Solar storms can knock out power grids and satellites. Station an early-warning sentinel between the Sun and Earth.',
      orbitFit: { l1: 1, l2: 0.3, geo: 0.35, sso: 0.25, leo: 0.2 },
      instFit: { plasma: 1, magnetometer: 1, coronagraph: 1, euv: 1, rad_mon: 0.6, cube_cam: 0.1 },
      primary: { text: 'Measure the incoming solar wind and its magnetic field', allOf: ['plasma', 'magnetometer'], why: 'Forecasters need both the particle stream and its magnetic direction to predict storm strength.' },
      secondary: [
        { text: 'Watch eruptions (CMEs) leave the Sun', anyOf: ['coronagraph'] },
        { text: 'Image solar flares as they happen', anyOf: ['euv'] },
      ],
      sciTarget: 60,
      real: 'ACE, SOHO and DSCOVR watch the solar wind from L1; NOAA\'s SWFO-L1 continues the job. SOHO\'s coronagraph has tracked thousands of CMEs.' },
    { id: 'mars', name: 'Red Planet Recon', body: 'Mars', level: 'Advanced', budget: 850, years: 4, icon: '🔴',
      blurb: 'Where did Mars\' water go? Map minerals that only form in water, scout landing sites, and hunt for buried ice.',
      orbitFit: { mars: 1 },
      instFit: { hyperspectral: 1, highres: 1, sar: 1, multispectral: 0.8, thermal_ir: 0.8, neutron: 0.8, lidar_alt: 0.7, magnetometer: 0.5, rad_mon: 0.5, cube_cam: 0.4 },
      primary: { text: 'Map minerals formed in water', anyOf: ['hyperspectral'], why: 'Clays and salts have unique colour fingerprints only an imaging spectrometer can resolve.' },
      secondary: [
        { text: 'Photograph candidate landing sites in detail', anyOf: ['highres'] },
        { text: 'Detect underground ice', anyOf: ['sar', 'neutron'] },
      ],
      sciTarget: 80,
      real: 'Mars Reconnaissance Orbiter carries HiRISE (high-res camera), CRISM (imaging spectrometer) and SHARAD (radar sounder); Mars Odyssey\'s neutron spectrometer found ground ice.' },
    { id: 'cosmic', name: 'Cosmic Dawn Observatory', body: 'Sun–Earth L2', level: 'Expert', budget: 1800, years: 5, icon: '🔭',
      blurb: 'See the first galaxies forming after the Big Bang. Build a cold infrared observatory far from Earth\'s heat.',
      orbitFit: { l2: 1, l1: 0.5, geo: 0.3, sso: 0.3, leo: 0.25 },
      instFit: { ir_tel: 1, nir_spec: 1, rad_mon: 0.2, cube_cam: 0.05 },
      primary: { text: 'Image the earliest galaxies in infrared', anyOf: ['ir_tel'], why: 'Light from the first galaxies is stretched into the infrared by the expansion of the Universe.' },
      secondary: [
        { text: 'Measure galaxy spectra to date them', anyOf: ['nir_spec'] },
      ],
      sciTarget: 120,
      real: 'The James Webb Space Telescope orbits L2 behind a five-layer sunshield, downlinking ~57 GB per day over Ka-band through the Deep Space Network.' },
    { id: 'sandbox', name: 'Sandbox', body: 'Anywhere', level: 'Free play', budget: 5000, years: 3, icon: '🧪', sandbox: true,
      blurb: 'No mission goal, no real budget pressure. Try anything and see what the physics says.',
      orbitFit: { leo: 1, sso: 1, geo: 1, l1: 1, l2: 1, moon: 1, mars: 1 },
      instFit: Object.fromEntries(['thermal_ir','multispectral','hyperspectral','highres','sar','neutron','lidar_alt','magnetometer','plasma','coronagraph','euv','ir_tel','nir_spec','rad_mon','cube_cam'].map(i => [i, 1])),
      primary: { text: 'Return any science data', anyOf: ['thermal_ir','multispectral','hyperspectral','highres','sar','neutron','lidar_alt','magnetometer','plasma','coronagraph','euv','ir_tel','nir_spec','rad_mon','cube_cam'], why: 'Anything goes!' },
      secondary: [],
      sciTarget: 60,
      real: 'Every real mission started as a sandbox sketch like this one.' },
  ];

  const byId = (arr, id) => arr.find(x => x.id === id) || null;
  const get = {
    orbit: id => byId(ORBITS, id), launcher: id => byId(LAUNCHERS, id), bus: id => byId(BUSES, id),
    power: id => byId(POWER, id), battery: id => byId(BATTERIES, id), comms: id => byId(COMMS, id),
    ground: id => byId(GROUND, id), adcs: id => byId(ADCS, id), computer: id => byId(COMPUTERS, id),
    propulsion: id => byId(PROPULSION, id), thermal: id => byId(THERMAL, id), risk: id => byId(RISK, id),
    inst: id => byId(INSTRUMENTS, id), scenario: id => byId(SCENARIOS, id), difficulty: id => DIFFICULTY[id],
  };

  function newDesign(scenarioId, difficultyId) {
    const sc = get.scenario(scenarioId);
    return {
      scenario: scenarioId, difficulty: difficultyId || 'engineer', years: sc ? sc.years : 3, risk: 'C',
      orbit: null, ground: null, comms: null, instruments: [],
      bus: null, power: null, battery: null, adcs: null, computer: null, propulsion: null, thermal: null,
      launcher: null,
    };
  }

  // Which choice-fields belong to which role (for ownership/sign-off)
  const FIELD_ROLE = {
    years: 'director', risk: 'director', launcher: 'director',
    orbit: 'flightops', ground: 'flightops', comms: 'flightops',
    instruments: 'science',
    bus: 'engineer', power: 'engineer', battery: 'engineer', adcs: 'engineer', computer: 'engineer', propulsion: 'engineer', thermal: 'engineer',
  };
  const REQUIRED_FIELDS = ['orbit', 'ground', 'comms', 'bus', 'power', 'battery', 'adcs', 'computer', 'propulsion', 'thermal', 'launcher'];

  const round = (x, n = 1) => { const p = Math.pow(10, n); return Math.round(x * p) / p; };

  // ======================================================================
  //  ENGINEERING MODEL
  // ======================================================================
  function analyze(d) {
    const sc = get.scenario(d.scenario);
    const diff = get.difficulty(d.difficulty) || DIFFICULTY.engineer;
    const orbit = get.orbit(d.orbit), bus = get.bus(d.bus), pw = get.power(d.power), bat = get.battery(d.battery);
    const comms = get.comms(d.comms), ground = get.ground(d.ground), adcs = get.adcs(d.adcs), comp = get.computer(d.computer);
    const prop = get.propulsion(d.propulsion), therm = get.thermal(d.thermal), lv = get.launcher(d.launcher);
    const risk = get.risk(d.risk) || RISK[1];
    const insts = (d.instruments || []).map(get.inst).filter(Boolean);
    const years = Math.max(1, d.years || 1);

    const mm = bus ? bus.massMult : 1, pm = bus ? bus.powerMult : 1, cm = bus ? bus.costMult : 1;
    const missing = REQUIRED_FIELDS.filter(f => !d[f]);
    if (!insts.length) missing.push('instruments');

    // ---- POWER ----
    const instPower = insts.reduce((s, i) => s + i.power, 0);
    const parts = {
      bus: bus ? bus.basePower : 0, instruments: instPower, comms: comms ? comms.power : 0,
      adcs: adcs ? adcs.power * pm : 0, computer: comp ? comp.power : 0,
    };
    let load = Object.values(parts).reduce((a, b) => a + b, 0);
    let thermalPower = 0;
    if (therm) thermalPower = load * therm.powerFrac + therm.power;
    parts.thermal = thermalPower;
    load += thermalPower;

    const eclipse = orbit ? orbit.eclipseMin : 0, period = orbit ? orbit.periodMin : 1;
    const solarFactor = orbit ? orbit.solar : 1;
    let required = load, availBOL = 0, availEOL = 0;
    if (pw && pw.type === 'solar') {
      // array must run the load in sunlight AND recharge what the battery spent in eclipse
      required = eclipse > 0 ? load * (1 + (eclipse / (period - eclipse)) / CHARGE_EFF) : load;
      availBOL = pw.watts * solarFactor;
      availEOL = availBOL * Math.max(0, 1 - SOLAR_DEGRADE * years);
    } else if (pw && pw.type === 'rtg') {
      required = load;
      availBOL = pw.watts;
      availEOL = pw.watts * Math.max(0, 1 - RTG_DEGRADE * years);
    }
    const powerMargin = required > 0 ? (availEOL - required) / required : 0;

    // ---- BATTERY ----
    const dod = orbit ? orbit.dod : 0.5;
    let batteryNeed = (bus ? bus.basePower : 0) * 1.0 / 0.7; // survive launch / safe mode for 1 h
    if (pw && pw.type === 'solar' && eclipse > 0) batteryNeed = Math.max(batteryNeed, load * (eclipse / 60) / dod);
    if (pw && pw.type === 'rtg') batteryNeed = Math.max(batteryNeed, load * 0.5 / dod); // peaks
    const batteryWh = bat ? bat.wh : 0;

    // ---- DELTA-V & MASS ----
    const dvNeedFull = orbit ? orbit.dvInsert + orbit.dvYear * years + orbit.dvDispose : 0;
    const instMass = insts.reduce((s, i) => s + i.mass, 0);
    let dryCore = (bus ? bus.mass : 0) + instMass + (pw ? pw.mass : 0) + (bat ? bat.mass : 0) + (comms ? comms.mass : 0)
      + (adcs ? adcs.mass * mm : 0) + (comp ? comp.mass : 0) + (prop ? prop.dry * mm : 0) + (therm ? therm.mass : 0);
    const thermalMass = therm ? dryCore * therm.massFrac : 0;
    const dryMass = (dryCore + thermalMass) * risk.massMult;
    let dvCap = 0, propMass = 0;
    if (prop && prop.id !== 'none' && dvNeedFull > 0) {
      const dvLoad = Math.min(dvNeedFull * 1.1, prop.maxDv); // 10% margin, limited by tank size
      propMass = dryMass * (Math.exp(dvLoad / (prop.isp * G0)) - 1);
      dvCap = dvLoad;
    } else if (prop && prop.id !== 'none') {
      dvCap = 0; propMass = 0;
    }
    const wetMass = dryMass + propMass;
    const lvCap = lv && orbit ? (lv.cap[orbit.id] || 0) : 0;
    const massMargin = lvCap > 0 ? (lvCap - wetMass) / lvCap : -1;

    // ---- DATA ----
    const reduction = comp ? comp.reduction : 1;
    const dataGen = insts.reduce((s, i) => s + i.data, 0) * reduction; // Gb/day
    const rate = comms && orbit ? comms.rate[orbit.dist] : 0;
    const hours = ground && orbit ? ground.hours[orbit.dist] : 0;
    const dataDown = rate * hours * 3.6; // Mbps * h * 3600 s / 1000 = Gb/day
    const dataRatio = dataGen > 0 ? dataDown / dataGen : (dataDown > 0 ? 9.99 : 0);

    // ---- POINTING ----
    const pointNeed = Math.min(30, ...insts.map(i => i.pointing), comms ? comms.pointing : 30);
    const pointHave = adcs ? adcs.pointing : 99;

    // ---- COST ($M) ----
    const cost = {
      bus: bus ? bus.cost : 0, instruments: insts.reduce((s, i) => s + i.cost, 0), power: pw ? pw.cost : 0,
      battery: bat ? bat.cost : 0, comms: comms ? comms.cost : 0, adcs: adcs ? adcs.cost * cm : 0,
      computer: comp ? comp.cost : 0, propulsion: prop ? prop.cost * cm : 0,
      thermal: therm ? (therm.id === 'cryo' ? therm.cost : therm.cost * cm) : 0,
    };
    const hardware = Object.values(cost).reduce((a, b) => a + b, 0);
    const integration = hardware * 0.15;
    const riskPremium = (hardware + integration) * (risk.costMult - 1);
    const development = hardware + integration + riskPremium;
    const launch = lv ? lv.cost : 0;
    const opsYear = (bus ? bus.opsYear : 0) + (ground ? ground.costYear : 0);
    const operations = opsYear * years;
    const total = development + launch + operations;
    const budget = (sc ? sc.budget : 0) * diff.budgetMult;
    const reserve = budget - total;

    // ---- SCIENCE POTENTIAL ----
    const orbitFit = sc && orbit ? (sc.orbitFit[orbit.id] || 0) : 0;
    const hasCryo = therm && therm.id === 'cryo';
    const instIds = insts.map(i => i.id);
    const instScience = insts.map(i => {
      let fit = sc ? (sc.instFit[i.id] || 0) : 0;
      let notes = [];
      if (i.requires && !instIds.includes(i.requires)) { fit *= 0.1; notes.push('needs ' + get.inst(i.requires).name); }
      let f = 1;
      if (i.needsCryo && !hasCryo) { f *= 0.05; notes.push('blinded by heat (no cryo)'); }
      if (adcs && adcs.pointing > i.pointing) { f *= 0.3; notes.push('pointing too coarse'); }
      return { id: i.id, name: i.name, fit, factor: f, value: i.value * fit * f, notes };
    });
    const rawScience = instScience.reduce((s, x) => s + x.value, 0);
    // until a subsystem is chosen, preview science as if it were adequate
    const dataFactor = (!comms || !ground || !orbit) ? 1 : Math.min(1, Math.pow(Math.max(0, dataRatio), 0.7));
    const powerFactor = (!pw || !orbit) ? 1 : (availEOL > 0 && required > 0 ? Math.min(1, availEOL / required) : 0);
    const sciencePerYear = rawScience * orbitFit * dataFactor * powerFactor; // "science points" at full health over nominal mission
    const sciencePotential = sc ? sciencePerYear / sc.sciTarget : 0; // 1.0 = target met over nominal life

    // ---- CHECKS ----
    const checks = [];
    const add = (id, role, status, label, msg, why) => checks.push({ id, role, status, label, msg, why });

    if (missing.length) add('missing', 'director', 'block', 'Design incomplete',
      'Still to choose: ' + missing.map(f => FIELD_LABEL[f] || f).join(', ') + '.', 'Every subsystem needs a decision before launch.');

    // Budget
    if (sc) {
      if (reserve < 0 && !sc.sandbox) add('budget', 'director', 'block', 'Over budget',
        `Mission costs $${round(total)}M but only $${round(budget)}M is available.`, 'No agency funds a mission that is over budget. Cheaper launch, fewer instruments, a lower risk class or a shorter mission all reduce cost.');
      else if (!sc.sandbox && reserve / budget < 0.1) add('budget', 'director', 'warn', 'Thin budget reserve',
        `Only $${round(reserve)}M (${Math.round(reserve / budget * 100)}%) in reserve.`, 'Real projects keep 10–30% reserve for surprises. Events during the mission may need money.');
      else add('budget', 'director', 'ok', 'Budget', `$${round(total)}M of $${round(budget)}M — $${round(reserve)}M reserve.`, '');
    }

    // Launch vehicle
    if (lv && orbit) {
      if (!lvCap) add('lv_reach', 'director', 'block', 'Rocket can\'t reach this orbit',
        `${lv.name} cannot deliver payloads to ${orbit.name}.`, 'Different destinations need different energy. Pick a bigger launcher.');
      else if (wetMass > lvCap) add('lv_mass', 'director', 'block', 'Too heavy for the rocket',
        `Spacecraft ${Math.round(wetMass)} kg vs. capacity ${lvCap} kg to ${orbit.short.split(' ·')[0]}.`, 'Every kilogram must be lifted. Reduce mass (smaller bus, lighter instruments, more efficient propulsion) or choose a bigger rocket.');
      else if (massMargin < 0.1) add('lv_mass', 'director', 'warn', 'Low launch-mass margin',
        `${Math.round(wetMass)} kg of ${lvCap} kg (${Math.round(massMargin * 100)}% margin).`, 'Spacecraft almost always gain weight during development. Engineers like 10–20% margin.');
      else add('lv_mass', 'director', 'ok', 'Launch mass', `${Math.round(wetMass)} kg of ${lvCap} kg (${Math.round(massMargin * 100)}% margin).`, '');
      if (lv.maxBus && bus && BUSES.findIndex(b => b.id === bus.id) > BUSES.findIndex(b => b.id === lv.maxBus))
        add('lv_bus', 'director', 'block', 'Spacecraft too big for this rocket',
          `${lv.name} only fits up to a ${get.bus(lv.maxBus).name}.`, 'Rideshare and small rockets have small payload fairings.');
    }

    // Orbit suits scenario
    if (sc && orbit && !sc.sandbox) {
      if (orbitFit === 0) add('orbit_fit', 'flightops', 'block', 'Wrong destination',
        `${orbit.name} can't accomplish "${sc.primary.text}".`, `This mission's target is ${sc.body}.`);
      else if (orbitFit < 0.7) add('orbit_fit', 'flightops', 'warn', 'Poor vantage point',
        `${orbit.name} only gives ${Math.round(orbitFit * 100)}% of the ideal science for this mission.`, 'Where you observe from matters as much as what you carry.');
    }

    // Payload accommodation
    if (bus) {
      if (instMass > bus.payloadMass) add('payload_mass', 'engineer', 'block', 'Instruments too heavy for the bus',
        `${Math.round(instMass)} kg of instruments; ${bus.name} supports ${bus.payloadMass} kg.`, 'The bus structure is designed around a maximum payload.');
      if (insts.length > bus.slots) add('payload_slots', 'engineer', 'block', 'Not enough instrument slots',
        `${insts.length} instruments; ${bus.name} has ${bus.slots} mounting slots.`, 'Each instrument needs space, a clear field of view and connections.');
      if (pw && pw.tier > bus.maxPowerTier && pw.type === 'solar') add('power_fit', 'engineer', 'block', 'Solar array too large for bus',
        `${bus.name} can't carry ${pw.name}.`, 'Bigger arrays need a stronger structure and drive motors.');
      if (pw && pw.type === 'rtg' && !bus.rtgOk) add('power_fit', 'engineer', 'block', 'RTG needs a bigger bus', 'Only Medium or Flagship spacecraft can host an RTG.', 'RTGs are heavy and hot.');
    }

    // Power
    if (pw && orbit) {
      if (powerMargin < 0) add('power', 'engineer', 'fail', 'Power deficit',
        `Need ${Math.round(required)} W, end-of-life supply ${Math.round(availEOL)} W.`,
        (eclipse > 0 ? `In this orbit the arrays must also recharge the battery after ${eclipse} min of shadow each orbit. ` : '') +
        (solarFactor < 1 ? `Sunlight here is only ${Math.round(solarFactor * 100)}% of Earth's. ` : '') +
        'Instruments will have to take turns (duty-cycling), cutting science.');
      else if (powerMargin < 0.15) add('power', 'engineer', 'warn', 'Low power margin',
        `${Math.round(powerMargin * 100)}% margin (${Math.round(availEOL)} W vs ${Math.round(required)} W needed).`, 'Solar cells degrade ~2.5% per year in space. A micrometeoroid hit could push you into deficit.');
      else add('power', 'engineer', 'ok', 'Power', `${Math.round(availEOL)} W supply vs ${Math.round(required)} W needed (${Math.round(powerMargin * 100)}% margin).`, '');
      if (prop && prop.power > 0 && availBOL < prop.power) add('ion_power', 'engineer', 'fail', 'Not enough power for ion engine',
        `Ion thrusters need ${prop.power} W; arrays give ${Math.round(availBOL)} W.`, 'Electric propulsion trades propellant for electricity.');
    }
    // Battery
    if (bat && orbit) {
      if (batteryWh < batteryNeed) add('battery', 'engineer', 'fail', 'Battery too small',
        `Need ${Math.round(batteryNeed)} Wh usable-equivalent, have ${batteryWh} Wh.`,
        eclipse > 0 ? `Each orbit has ${eclipse} min of darkness. Batteries may only be drained to ${Math.round(dod * 100)}% depth or they wear out fast over thousands of cycles.` : 'The battery must carry the spacecraft through launch and safe mode.');
      else add('battery', 'engineer', 'ok', 'Battery', `${batteryWh} Wh vs ${Math.round(batteryNeed)} Wh needed.`, '');
    }
    // Delta-v
    if (prop && orbit) {
      const needCore = orbit.dvInsert + orbit.dvYear * years;
      if (orbit.dvInsert > 0 && dvCap < orbit.dvInsert) add('dv', 'engineer', 'fail', 'Can\'t brake into orbit',
        `Orbit insertion needs ${orbit.dvInsert} m/s; your propulsion provides ${Math.round(dvCap)} m/s.`, 'Without the capture burn the spacecraft flies right past its target. Choose a higher-performance engine.');
      else if (dvCap < needCore && orbit.stationKeepLimitsLife) add('dv', 'engineer', 'warn', 'Fuel runs out early',
        `Needs ${Math.round(needCore)} m/s for ${years} yr; carries ${Math.round(dvCap)} m/s.`, 'Station-keeping burns are needed every year to stay in this orbit. When fuel runs out, the mission ends.');
      else if (dvCap < needCore) add('dv', 'flightops', 'warn', 'No orbit maintenance',
        'Without orbit-trim fuel the ground track will drift (−10% science).', 'Small burns keep the orbit and imaging schedule predictable.');
      else add('dv', 'engineer', 'ok', 'Propulsion (Δv)', `${Math.round(dvCap)} m/s available vs ${Math.round(dvNeedFull)} m/s planned.`, '');
      if (orbit.dvDispose > 0 && dvCap < dvNeedFull) add('disposal', 'flightops', 'warn', 'No end-of-life disposal',
        `De-orbit / graveyard burn needs ${orbit.dvDispose} m/s more fuel.`, 'Space-debris rules require satellites to leave crowded orbits after their mission (within 5 years in the US). Dead satellites are collision hazards for everyone.');
      if (prop.slow && orbit.transitDays > 3) add('ion_slow', 'flightops', 'warn', 'Slow transfer',
        'Ion propulsion spirals out gently: transfer takes months longer.', 'Low thrust = long journey, but huge fuel savings.');
    }
    // Comms
    if (comms && ground && orbit) {
      if (rate === 0 || hours === 0) add('link', 'flightops', 'fail', 'No communication link',
        rate === 0 ? `${comms.name} is too weak to be heard from ${orbit.name}.` : `${ground.name} can't track a spacecraft at ${orbit.name}.`,
        'Signal strength falls with the square of distance. Deep-space missions need big antennas on both ends.');
      else if (dataRatio < 1) add('data', 'flightops', 'warn', 'Data bottleneck',
        `Instruments make ${round(dataGen)} Gb/day; you can downlink ${round(dataDown)} Gb/day (${Math.round(dataRatio * 100)}%).`, 'Data that can\'t be sent home is lost. Faster radio, more ground passes, or onboard processing all help.');
      else add('data', 'flightops', 'ok', 'Data downlink', `${round(dataDown)} Gb/day capacity vs ${round(dataGen)} Gb/day produced.`, '');
    }
    // Pointing
    if (adcs && orbit) {
      if (adcs.earthOnly && orbit.body !== 'earth') add('mtq', 'engineer', 'fail', 'Magnetorquers useless here',
        'There is no strong magnetic field to push against away from Earth.', 'Away from Earth you need reaction wheels or thrusters to point.');
      if (pointHave > pointNeed) add('pointing', 'engineer', 'warn', 'Pointing not precise enough',
        `Payload needs ${pointNeed}°; attitude control gives ${pointHave}°.`, 'Blurry images and a wobbling antenna beam. Affected instruments return ~30% of their science.');
      else if (insts.length) add('pointing', 'engineer', 'ok', 'Pointing', `${pointHave}° achieved vs ${pointNeed}° required.`, '');
    }
    // Radiation
    if (comp && orbit && comp.radTol < orbit.radiation) add('radiation', 'engineer', 'warn', 'Radiation risk',
      `${orbit.name} is a harsh radiation environment for a ${comp.name.toLowerCase()}.`, 'Energetic particles flip memory bits and can latch up chips. Expect resets and possible failure.');
    // Thermal
    if (therm && orbit && therm.level < orbit.thermal) add('thermal', 'engineer', 'warn', 'Thermal risk',
      `${orbit.name} has extreme temperature swings; passive thermal control is marginal.`, 'Electronics that get too hot or cold fail. Heaters and radiators keep them in range.');
    insts.filter(i => i.needsCryo).forEach(i => { if (!hasCryo) add('cryo_' + i.id, 'engineer', 'fail', 'Infrared instrument too warm',
      `${i.name} needs a sunshield + cryocooler.`, 'A warm infrared telescope glows in its own detectors, drowning the faint signal.'); });
    // Instrument relevance
    instScience.filter(x => x.fit === 0 && sc && !sc.sandbox).forEach(x => add('fit_' + x.id, 'science', 'warn', 'Instrument off-mission',
      `${x.name} adds nothing to this mission's goals.`, 'Every instrument costs mass, power and money. Carry only what the science needs.'));
    insts.filter(i => i.requires && !instIds.includes(i.requires)).forEach(i => add('req_' + i.id, 'science', 'fail', 'Missing companion instrument',
      `${i.name} needs the ${get.inst(i.requires).name}.`, 'Some instruments only work as part of a larger system.'));
    // Primary objective possible?
    if (sc && insts.length) {
      const ok = objectivePossible(sc.primary, instIds);
      if (!ok) add('primary', 'science', 'fail', 'Primary objective impossible',
        `No instrument can "${sc.primary.text}".`, sc.primary.why);
      else add('primary', 'science', 'ok', 'Primary objective', `Payload can ${sc.primary.text.toLowerCase()}.`, '');
    }
    // Low TRL / experimental
    if (comms && comms.risky) add('trl', 'flightops', 'warn', 'Experimental technology', 'Laser comms are still being proven: expect occasional outages.', 'Technology Readiness Level (TRL) measures how proven a technology is (1 = idea, 9 = flown many times).');

    const order = { block: 0, fail: 1, warn: 2, ok: 3 };
    checks.sort((a, b) => order[a.status] - order[b.status]);

    const roleGoals = {
      director: reserve >= 0.1 * budget,
      science: sciencePotential >= 1,
      engineer: powerMargin >= 0.2 && massMargin >= 0.15,
      flightops: dataRatio >= 1.5 && (!orbit || !orbit.dvDispose || dvCap >= dvNeedFull),
    };

    return {
      scenario: sc, diff, orbit, bus, years, risk, insts, missing,
      power: { load, required, availBOL, availEOL, margin: powerMargin, parts, eclipse, solarFactor },
      battery: { need: batteryNeed, have: batteryWh, dod },
      mass: { dry: dryMass, prop: propMass, wet: wetMass, cap: lvCap, margin: massMargin, instMass, payloadCap: bus ? bus.payloadMass : 0 },
      dv: { need: dvNeedFull, cap: dvCap },
      data: { gen: dataGen, down: dataDown, ratio: dataRatio, rate, hours },
      pointing: { need: pointNeed, have: pointHave },
      cost: { parts: cost, hardware, integration, riskPremium, development, launch, operations, opsYear, total, budget, reserve },
      science: { perInst: instScience, raw: rawScience, orbitFit, dataFactor, powerFactor, perYear: sciencePerYear, potential: sciencePotential },
      checks,
      blocks: checks.filter(c => c.status === 'block'),
      fails: checks.filter(c => c.status === 'fail'),
      warns: checks.filter(c => c.status === 'warn'),
      roleGoals,
    };
  }

  function objectivePossible(obj, instIds) {
    if (obj.allOf) return obj.allOf.every(i => instIds.includes(i));
    return obj.anyOf.some(i => instIds.includes(i));
  }

  const FIELD_LABEL = {
    orbit: 'orbit', ground: 'ground stations', comms: 'radio', bus: 'spacecraft bus', power: 'power source', battery: 'battery',
    adcs: 'attitude control', computer: 'flight computer', propulsion: 'propulsion', thermal: 'thermal control', launcher: 'launch vehicle',
    instruments: 'instruments',
  };

  // ======================================================================
  //  RANDOM NUMBERS
  // ======================================================================
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ======================================================================
  //  DECISION EVENTS
  // ======================================================================
  // Each event: when(ctx) -> applicable; choices: [{label, detail, enabled(ctx), apply(ctx)->text}]
  const EVENTS = [
    { id: 'storm', title: 'Solar storm incoming!', icon: '☀️',
      text: 'Forecasters see a coronal mass ejection heading our way. Charged particles arrive in ~18 hours.',
      learn: 'Solar storms flood electronics with energetic particles. Operators often put spacecraft into "safe mode" — a minimal, protected state — until it passes.',
      when: c => true,
      choices: [
        { label: 'Enter safe mode', detail: 'Lose ~2 weeks of observations. No risk.', apply: c => { c.lostMonths += 0.5; return 'Spacecraft rode out the storm safely in safe mode.'; } },
        { label: 'Keep observing', detail: 'Keep collecting data. Risky without radiation-hardened electronics.',
          apply: c => {
            const tol = c.m.orbit ? (get.computer(c.d.computer).radTol - c.m.orbit.radiation) : 0;
            const p = tol >= 0 ? 0.1 : 0.45;
            if (c.sc.id === 'solar') c.bonus += 0.06;
            if (c.r() < p) { c.health -= 0.15; c.lostMonths += 1; return 'A memory upset rebooted the flight computer. Recovered after a month, with some lasting damage.' + (c.sc.id === 'solar' ? ' But the storm data itself is priceless!' : ''); }
            return 'Electronics held up' + (c.sc.id === 'solar' ? ' — and you captured a superb storm measurement (+science)!' : '. No harm done.');
          } },
      ] },
    { id: 'wheel', title: 'Reaction wheel friction rising', icon: '⚙️',
      text: 'Telemetry shows one reaction wheel drawing extra current — a sign of bearing wear.',
      learn: 'Reaction-wheel failures have ended or crippled real missions (Kepler lost two wheels). Redundant wheels are a classic reason to pay for a higher risk class.',
      when: c => { const a = get.adcs(c.d.adcs); return a && a.wheels; },
      choices: [
        { label: 'Switch to backup wheel', detail: 'Only available with Class B/A redundancy.', enabled: c => c.m.risk.redundancy,
          apply: c => 'Backup wheel spun up. Pointing nominal — redundancy paid off.' },
        { label: 'Fund a software workaround ($3M)', detail: 'Engineers rewrite control software to use fewer wheels.', enabled: c => c.reserve >= 3,
          apply: c => { c.reserve -= 3; c.health -= 0.03; return 'New software keeps the spacecraft pointing with reduced agility.'; } },
        { label: 'Keep running it', detail: 'Free, but the wheel may seize.', apply: c => {
          if (c.r() < 0.5) { c.health -= 0.2; return 'The wheel seized. Pointing degraded — images now often blurred.'; }
          return 'The wheel stabilised. Lucky!'; } },
      ] },
    { id: 'ground', title: 'Ground station outage', icon: '📡',
      text: 'A storm damaged your primary ground antenna. Repairs take 3 weeks.',
      learn: 'Ground segment is part of the mission! Spacecraft store data on board, but memory is limited.',
      when: c => true,
      choices: [
        { label: 'Buy extra passes ($2M)', detail: 'Rent antennas from another network.', enabled: c => c.reserve >= 2,
          apply: c => { c.reserve -= 2; return 'Backup antennas kept data flowing. No loss.'; } },
        { label: 'Store data on board', detail: 'Free. Onboard memory fills up and some data is overwritten.', apply: c => {
          const edge = c.d.computer === 'edge';
          c.lostMonths += edge ? 0.2 : 0.6;
          return edge ? 'Onboard processing compressed data — only a little was lost.' : 'Memory filled up after a week; about half the data from the outage was lost.'; } },
      ] },
    { id: 'debris', title: 'Collision alert!', icon: '💥',
      text: 'A defunct rocket body may pass within 150 m. Probability of collision: 1 in 300.',
      learn: 'Thousands of debris pieces are tracked. Operators perform "collision avoidance manoeuvres" when risk exceeds ~1 in 10,000. Without propulsion you can only watch.',
      when: c => c.m.orbit && c.m.orbit.body === 'earth' && c.m.orbit.id !== 'geo',
      choices: [
        { label: 'Fire thrusters to dodge', detail: 'Uses a little propellant.', enabled: c => c.d.propulsion !== 'none' && c.m.dv.cap > 0,
          apply: c => { c.dvUsed += 1; return 'Avoidance burn complete. Debris passed 4 km away.'; } },
        { label: 'Accept the risk', detail: 'No fuel spent.', apply: c => {
          if (c.r() < 0.05) { c.health = 0; return 'Impact! The spacecraft broke apart — and created new debris.'; }
          return 'The debris passed by harmlessly. Phew.'; } },
      ] },
    { id: 'anomaly', title: 'Instrument anomaly', icon: '🔬',
      text: 'One science instrument is returning noisy data after a power glitch.',
      learn: 'Operators diagnose problems from telemetry alone — nobody can visit. "Turn it off and on again" is genuinely a space-ops technique.',
      when: c => true,
      choices: [
        { label: 'Reboot & recalibrate', detail: '70% chance of full fix; could make it worse.', apply: c => {
          if (c.r() < 0.7) return 'Recalibration worked. Data is clean again.';
          c.health -= 0.12; return 'Reboot failed: the instrument now runs in a degraded mode.'; } },
        { label: 'Run in reduced mode', detail: 'Safe, small permanent loss.', apply: c => { c.health -= 0.05; return 'Instrument operating in safe reduced mode.'; } },
      ] },
    { id: 'discovery', title: 'Unexpected discovery!', icon: '✨',
      text: 'Scientists spotted something unusual and want to re-plan observations to study it.',
      learn: 'Many of the biggest discoveries were unplanned. Flexible operations — and a budget reserve — let missions chase surprises.',
      when: c => true,
      choices: [
        { label: 'Re-plan observations ($2M)', detail: 'Extra operations work. Big science payoff.', enabled: c => c.reserve >= 2,
          apply: c => { c.reserve -= 2; c.bonus += 0.12; return 'The new observations made headlines! (+12% science)'; } },
        { label: 'Stick to the plan', detail: 'Keep the schedule and the money.', apply: c => 'Observations continued as planned.' },
      ] },
    { id: 'budgetcut', title: 'Operations budget cut', icon: '💸',
      text: 'The agency is short of money and cuts your operations funding by 20% for the rest of the mission.',
      learn: 'Missions compete for funding every year. A reserve protects the science.',
      when: c => true,
      choices: [
        { label: 'Cover it from reserve', detail: 'Pay the difference.', enabled: c => c.reserve >= c.cutCost(),
          apply: c => { const x = c.cutCost(); c.reserve -= x; return `Paid $${round(x)}M from reserve. Operations unchanged.`; } },
        { label: 'Reduce operations', detail: 'Fewer ground passes and staff: −15% data for the rest of the mission.',
          apply: c => { c.opsFactor *= 0.85; return 'Operations scaled back. Science return reduced.'; } },
      ] },
    { id: 'mmod', title: 'Micrometeoroid strike', icon: '☄️',
      text: 'A sand-grain-sized particle punched through a solar panel at 10 km/s, cutting power by 10%.',
      learn: 'Power margin is your insurance policy against damage like this.',
      when: c => get.power(c.d.power) && get.power(c.d.power).type === 'solar',
      choices: [
        { label: 'Assess the damage', detail: 'See if the power margin absorbs it.', apply: c => {
          const m = c.m.power.margin;
          if (m >= 0.12) return 'Your power margin absorbed the loss. Operations continue normally.';
          c.health -= 0.12; return 'With little margin, instruments must now take turns. Science reduced.'; } },
      ] },
  ];

  // ======================================================================
  //  SIMULATION
  // ======================================================================
  function createSim(d, seed) {
    const m = analyze(d);
    const r = rng(seed || (Date.now() & 0xffffffff));
    const diff = m.diff;
    const lv = get.launcher(d.launcher), pw = get.power(d.power), prop = get.propulsion(d.propulsion);
    const totalMonths = Math.round(m.years * 12);
    const sc = m.scenario;

    // effective operating life limited by station-keeping fuel
    let lifeMonths = totalMonths;
    if (m.orbit && m.orbit.stationKeepLimitsLife && m.orbit.dvYear > 0) {
      const dvForOps = m.dv.cap - m.orbit.dvInsert;
      const yearsFuel = Math.max(0, dvForOps / m.orbit.dvYear);
      lifeMonths = Math.min(totalMonths, Math.floor(yearsFuel * 12));
    }

    // hazard per month
    let hazard = 0.0012 * m.risk.hazMult * diff.hazardMult;
    const comp = get.computer(d.computer), therm = get.thermal(d.thermal);
    if (comp && m.orbit && comp.radTol < m.orbit.radiation) hazard += 0.006 * (m.orbit.radiation - comp.radTol) * diff.hazardMult;
    if (therm && m.orbit && therm.level < m.orbit.thermal) hazard += 0.006 * diff.hazardMult;
    if (m.battery.have < m.battery.need) hazard += 0.02 * diff.hazardMult;
    if (get.comms(d.comms) && get.comms(d.comms).risky) hazard += 0.002;

    const ctx = {
      d, m, sc, r, health: 1, lostMonths: 0, bonus: 0, opsFactor: 1, reserve: Math.max(0, m.cost.reserve), dvUsed: 0,
      cutCost: () => 0.2 * m.cost.opsYear * Math.max(0, (totalMonths - ctx.month) / 12),
      month: 0,
    };

    // pick decision events
    const nEvents = Math.min(diff.events, Math.max(1, Math.floor(totalMonths / 6)));
    const pool = EVENTS.filter(e => e.when(ctx));
    const picked = [];
    const poolCopy = pool.slice();
    while (picked.length < nEvents && poolCopy.length) picked.push(poolCopy.splice(Math.floor(r() * poolCopy.length), 1)[0]);
    const eventMonths = picked.map((e, i) => Math.max(1, Math.round(((i + 1) / (picked.length + 1)) * Math.min(totalMonths, Math.max(lifeMonths, 2)))));

    const sim = {
      ctx, m, totalMonths, lifeMonths, phase: 'prelaunch', log: [], done: false, outcome: null,
      science: 0, scienceMax: m.science.perYear * m.years, extendedMonths: 0, transitDays: m.orbit ? m.orbit.transitDays * (prop && prop.slow ? 3 : 1) : 0,
      pendingEvent: null, events: picked.map((e, i) => ({ event: e, month: eventMonths[i], done: false })),
      lost: false, lostReason: '', insertionFailed: false, decisions: [],
    };
    const log = (t, kind = 'info') => sim.log.push({ t, kind, month: ctx.month });

    sim.step = function () {
      if (sim.done || sim.pendingEvent) return;
      switch (sim.phase) {
        case 'prelaunch':
          log(`T-0: ${lv.name} lifts off carrying ${Math.round(m.mass.wet)} kg.`, 'phase');
          sim.phase = 'launch'; return;
        case 'launch': {
          let rel = lv.reliability; if (diff.launchSafe) rel = 1;
          if (r() > rel) { sim.lost = true; sim.lostReason = 'Launch vehicle failure'; log('Launch failure! The rocket did not reach orbit.', 'bad'); return sim.finish(); }
          log('Nominal ascent. Spacecraft separated from the rocket.', 'good');
          sim.phase = 'deploy'; return;
        }
        case 'deploy': {
          const hasDeploy = pw && pw.type === 'solar' && pw.tier > 0;
          const p = (hasDeploy ? 0.015 : 0.003) * m.risk.hazMult * diff.hazardMult;
          if (r() < p) { ctx.health -= 0.35; log('A solar panel only partially deployed! Power permanently reduced.', 'bad'); }
          else log(hasDeploy ? 'Solar arrays and antennas deployed. Power positive!' : 'Systems checked out. Power positive!', 'good');
          sim.phase = sim.transitDays > 3 ? 'cruise' : 'ops';
          if (sim.phase === 'ops') log(`Arrived in ${m.orbit.name}. Science operations begin.`, 'phase');
          return;
        }
        case 'cruise': {
          log(`Cruise: ${Math.round(sim.transitDays)} days to ${m.orbit.name}.`, 'phase');
          if (m.orbit.dvInsert > 0) sim.phase = 'insertion'; else { sim.phase = 'ops'; log(`Arrived at ${m.orbit.name}. Science operations begin.`, 'phase'); }
          return;
        }
        case 'insertion': {
          if (m.dv.cap < m.orbit.dvInsert) {
            sim.insertionFailed = true; sim.lost = true; sim.lostReason = 'Not enough propellant for orbit insertion';
            sim.science += m.science.perYear * 0.03; // quick flyby snapshots
            log(`Insertion burn needs ${m.orbit.dvInsert} m/s but only ${Math.round(m.dv.cap)} m/s available. The spacecraft flew past ${m.scenario.body === 'Mars' ? 'Mars' : 'the Moon'}.`, 'bad');
            return sim.finish();
          }
          if (r() < 0.01 * m.risk.hazMult * diff.hazardMult) { sim.lost = true; sim.lostReason = 'Engine anomaly during orbit insertion'; log('Engine anomaly during the capture burn — contact lost.', 'bad'); return sim.finish(); }
          log(`Orbit insertion burn: ${m.orbit.dvInsert} m/s. Captured into orbit!`, 'good');
          log('Science operations begin.', 'phase');
          sim.phase = 'ops'; return;
        }
        case 'ops': {
          const limit = sim.extendedMonths ? totalMonths + sim.extendedMonths : lifeMonths;
          if (ctx.month >= limit || ctx.health <= 0) return sim.endOps();
          // scheduled decision event
          const ev = sim.events.find(e => !e.done && e.month <= ctx.month + 1);
          if (ev) { ev.done = true; sim.pendingEvent = ev.event; return; }
          ctx.month++;
          // science this month
          const perMonth = m.science.perYear / 12;
          const dvShort = !m.orbit.stationKeepLimitsLife && m.dv.cap < m.orbit.dvInsert + m.orbit.dvYear * m.years ? 0.9 : 1;
          sim.science += perMonth * Math.max(0, ctx.health) * ctx.opsFactor * dvShort;
          // random failure
          if (r() < hazard) {
            const fatal = r() < (m.risk.redundancy ? 0.1 : 0.3);
            const sys = ['power system', 'flight computer', 'star tracker', 'transponder', 'heater circuit', 'instrument electronics'][Math.floor(r() * 6)];
            if (fatal) { ctx.health = 0; log(`Month ${ctx.month}: critical failure in the ${sys}. Contact lost.`, 'bad'); sim.lost = true; sim.lostReason = `Failure of the ${sys}`; return sim.endOps(); }
            const hit = m.risk.redundancy ? 0.05 : 0.15;
            ctx.health -= hit;
            log(`Month ${ctx.month}: ${sys} fault. ${m.risk.redundancy ? 'Switched to backup unit.' : 'Operating in degraded mode.'}`, 'warn');
          }
          if (ctx.month % 12 === 0) log(`Year ${ctx.month / 12} complete. Health ${Math.round(Math.max(0, ctx.health) * 100)}%.`, 'info');
          return;
        }
        case 'extend?': return;
      }
    };

    sim.resolve = function (choiceIdx) {
      const ev = sim.pendingEvent; if (!ev) return;
      const ch = ev.choices[choiceIdx];
      const result = ch.apply(ctx);
      sim.decisions.push({ event: ev.title, choice: ch.label, result });
      log(`${ev.icon} ${ev.title} → ${ch.label}. ${result}`, ctx.health <= 0 ? 'bad' : 'event');
      sim.pendingEvent = null;
      if (ctx.health <= 0) { sim.lost = true; sim.lostReason = ev.title; sim.endOps(); }
    };

    sim.endOps = function () {
      if (ctx.health > 0 && ctx.month < totalMonths && lifeMonths < totalMonths && ctx.month >= lifeMonths && !sim.extendedMonths) {
        log(`Station-keeping propellant exhausted after ${Math.round(ctx.month)} months. Mission ended early.`, 'bad');
      }
      // extension offer
      if (ctx.health > 0.5 && !sim.extendedMonths && ctx.month >= totalMonths && !sim.lost) {
        const dvLeft = m.dv.cap - m.orbit.dvInsert - m.orbit.dvYear * m.years - m.orbit.dvDispose;
        const canFuel = !m.orbit.stationKeepLimitsLife || dvLeft >= m.orbit.dvYear;
        sim.extensionOffer = { cost: m.cost.opsYear, canFuel, canPay: ctx.reserve >= m.cost.opsYear };
        sim.phase = 'extend?';
        return;
      }
      sim.finish();
    };

    sim.extend = function (yes) {
      if (yes && sim.extensionOffer && sim.extensionOffer.canFuel && sim.extensionOffer.canPay) {
        ctx.reserve -= sim.extensionOffer.cost;
        sim.extendedMonths = 12; sim.phase = 'ops';
        log(`Extended mission approved (+1 year, $${round(sim.extensionOffer.cost)}M from reserve).`, 'good');
        sim.extensionOffer = null;
      } else { sim.extensionOffer = null; sim.finish(); }
    };

    sim.finish = function () {
      if (sim.done) return;
      sim.done = true;
      sim.science -= (m.science.perYear / 12) * ctx.lostMonths;
      sim.science = Math.max(0, sim.science) * (1 + ctx.bonus);
      // disposal
      sim.disposed = !m.orbit || !m.orbit.dvDispose || (m.dv.cap - ctx.dvUsed >= m.dv.need && !sim.lost);
      if (m.orbit && m.orbit.dvDispose && !sim.lost) log(sim.disposed ? 'End of life: disposal burn completed — orbit left clean.' : 'End of life: no fuel to dispose — the spacecraft remains as space debris.', sim.disposed ? 'good' : 'warn');
      if (m.orbit && m.orbit.id === 'leo' && !sim.lost) log('End of life: atmospheric drag will bring the spacecraft down naturally within a few years.', 'good');
      sim.outcome = score(d, m, sim);
      log('Mission complete.', 'phase');
    };

    return sim;
  }

  // ======================================================================
  //  SCORING
  // ======================================================================
  function score(d, m, sim) {
    const sc = m.scenario;
    const sciPct = sc ? sim.science / (sc.sciTarget * m.years) : 0;
    const instIds = m.insts.map(i => i.id);
    const opMonths = sim.ctx.month;
    const minOps = Math.max(3, sim.totalMonths * 0.25);
    const operatedEnough = !sim.insertionFailed && opMonths >= minOps;
    const instWorks = id => { const s = m.science.perInst.find(x => x.id === id); return s && s.factor > 0.2 && s.fit > 0; };
    const objMet = o => operatedEnough && m.data.ratio > 0.2 && (o.allOf ? o.allOf.every(i => instIds.includes(i) && instWorks(i)) : o.anyOf.some(i => instIds.includes(i) && instWorks(i)));
    const primary = sc ? objMet(sc.primary) : false;
    const secondary = sc ? sc.secondary.map(o => ({ text: o.text, met: objMet(o) })) : [];

    const sciencePts = Math.round(500 * Math.min(1.3, sciPct));
    const primaryPts = primary ? 200 : 0;
    const secondaryPts = secondary.filter(s => s.met).length * 75;
    const reserveFrac = Math.max(0, sim.ctx.reserve) / m.cost.budget;
    const efficiencyPts = sc && !sc.sandbox ? Math.round(Math.min(100, reserveFrac * 400)) : 0;
    const needsDisposal = m.orbit && m.orbit.dvDispose > 0;
    const sustainPts = needsDisposal ? (sim.disposed ? 50 : -50) : (sim.lost ? 0 : 50);
    const overridePts = -50 * m.fails.length;

    const fullLife = sim.ctx.month >= sim.totalMonths;
    let outcome;
    if (sim.lost && opMonths < minOps) outcome = 'failure';
    else if (primary && fullLife && sciPct >= 0.75) outcome = 'success';
    else if (primary || sciPct >= 0.3) outcome = 'partial';
    else outcome = 'failure';

    const goals = {
      director: reserveFrac >= 0.1 && outcome === 'success',
      science: sciPct >= 1,
      engineer: m.power.margin >= 0.2 && m.mass.margin >= 0.15,
      flightops: m.data.ratio >= 1.5 && (needsDisposal ? sim.disposed : true),
    };
    const goalPts = Object.values(goals).filter(Boolean).length * 40;
    const total = Math.max(0, sciencePts + primaryPts + secondaryPts + efficiencyPts + sustainPts + overridePts + goalPts);
    const stars = total >= 1100 ? 3 : total >= 800 ? 2 : total >= 450 ? 1 : 0;

    return { sciPct, sciencePts, primary, primaryPts, secondary, secondaryPts, efficiencyPts, reserveFrac, sustainPts, overridePts,
      goals, goalPts, total, stars, outcome, opMonths, fullLife };
  }

  // ======================================================================
  //  DESIGN CODES (share / compare)
  // ======================================================================
  function encode(d) {
    const keys = ['scenario','difficulty','years','risk','orbit','ground','comms','instruments','bus','power','battery','adcs','computer','propulsion','thermal','launcher'];
    const arr = keys.map(k => d[k]);
    const json = JSON.stringify(arr);
    const b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json).toString('base64');
    return 'MA1-' + b64;
  }
  function decode(code) {
    try {
      const s = code.trim().replace(/^MA1-/, '');
      const json = typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString();
      const arr = JSON.parse(json);
      const keys = ['scenario','difficulty','years','risk','orbit','ground','comms','instruments','bus','power','battery','adcs','computer','propulsion','thermal','launcher'];
      const d = {}; keys.forEach((k, i) => d[k] = arr[i]);
      if (!get.scenario(d.scenario)) return null;
      if (!Array.isArray(d.instruments)) d.instruments = [];
      return d;
    } catch (e) { return null; }
  }

  return { ROLES, ROLE_ORDER, DIFFICULTY, RISK, ORBITS, LAUNCHERS, BUSES, POWER, BATTERIES, COMMS, GROUND, ADCS, COMPUTERS,
    PROPULSION, THERMAL, INSTRUMENTS, SCENARIOS, EVENTS, FIELD_ROLE, FIELD_LABEL, REQUIRED_FIELDS,
    get, newDesign, analyze, createSim, score, rng, encode, decode, round, objectivePossible };
})();
if (typeof module !== 'undefined') module.exports = GAME;
