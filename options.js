/* Universal Focus — Settings JS */

const DEFAULT_SETTINGS = {
  indicatorColor:    "#b7ff3c",
  indicatorDuration: 1200,
  ignoreTiny:        true,
  skipPasswords:     true,
  enabled:           true,
  debugMode:         false,
  sitePreferences:   {},
  autoFocusSites:    [],
  slashToFocus:      true,
  escapeToBlur:      true,
  soundEnabled:      true,
  soundVolume:       0.85,
  customSelectors:   {}
};

const $ = (id) => document.getElementById(id);

/* ══════════════════════════════════════════════
   COLOR SYNC
══════════════════════════════════════════════ */
function syncColor(color) {
  const preview = $("colorPreview");
  if (preview) preview.style.background = color;

  const accent = color || DEFAULT_SETTINGS.indicatorColor;
  document.documentElement.style.setProperty("--accent", accent);
  document.querySelectorAll(".preview-field, .live-editor").forEach((el) => {
    el.style.borderColor = `${accent}66`;
    el.style.boxShadow   = `0 0 0 5px ${accent}0d, 0 0 24px ${accent}22`;
  });
  document.querySelectorAll(".preview-caret, .live-caret").forEach((el) => {
    el.style.background = accent;
  });
  document.querySelectorAll(".preview-pulse").forEach((el) => {
    el.style.borderColor = `${accent}44`;
  });
  document.querySelectorAll(".status-dot").forEach((el) => {
    el.style.background = accent;
    el.style.boxShadow  = `0 0 0 3px ${accent}2e, 0 0 8px ${accent}66`;
  });
  const ring = $("cursorRing");
  if (ring) ring.style.borderColor = `${accent}aa`;
  const spotlight = $("cursorSpotlight");
  if (spotlight) {
    spotlight.style.background = `radial-gradient(circle, ${accent}0e 0%, ${accent}05 35%, transparent 70%)`;
  }
}

/* ── Labels ── */
function updateDurationLabel(value) {
  const out = $("durationValue");
  if (out) { out.value = value; out.textContent = value; }
}
function updateVolumeLabel(value) {
  const out = $("volumeValue");
  if (out) { out.value = value; out.textContent = value; }
}

/* ══════════════════════════════════════════════
   LOAD / SAVE
══════════════════════════════════════════════ */
async function loadSettings() {
  const settings = { ...DEFAULT_SETTINGS, ...(await chrome.storage.local.get(DEFAULT_SETTINGS)) };

  $("indicatorColor").value    = settings.indicatorColor;
  $("indicatorDuration").value = settings.indicatorDuration;
  updateDurationLabel(settings.indicatorDuration);
  syncColor(settings.indicatorColor);

  $("ignoreTiny").checked    = settings.ignoreTiny;
  $("skipPasswords").checked = settings.skipPasswords;
  $("debugMode").checked     = settings.debugMode;
  $("slashToFocus").checked  = settings.slashToFocus;
  $("escapeToBlur").checked  = settings.escapeToBlur;

  $("soundEnabled").checked  = settings.soundEnabled;
  const volPercent = Math.round((settings.soundVolume !== undefined ? Number(settings.soundVolume) : 0.85) * 100);
  $("soundVolume").value     = volPercent;
  updateVolumeLabel(volPercent);
  toggleSoundVolume(settings.soundEnabled);

  renderSites(settings.sitePreferences);
  renderAutoFocusSites(settings.autoFocusSites);
  renderSelectors(settings.customSelectors);
  loadStats();
}

async function saveSettings() {
  const current = await chrome.storage.local.get(DEFAULT_SETTINGS);
  await chrome.storage.local.set({
    ...current,
    indicatorColor:    $("indicatorColor").value,
    indicatorDuration: Math.min(5000, Math.max(100, Number($("indicatorDuration").value) || 1200)),
    ignoreTiny:        $("ignoreTiny").checked,
    skipPasswords:     $("skipPasswords").checked,
    debugMode:         $("debugMode").checked,
    slashToFocus:      $("slashToFocus").checked,
    escapeToBlur:      $("escapeToBlur").checked,
    soundEnabled:      $("soundEnabled").checked,
    soundVolume:       Math.max(0.05, Math.min(1, Number($("soundVolume").value) / 100))
  });
  toggleSoundVolume($("soundEnabled").checked);
  showStatus("Settings saved.");
}

let statusTimer;
function showStatus(msg) {
  const el = $("status");
  el.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { el.textContent = ""; }, 2000);
}

/* ══════════════════════════════════════════════
   SOUND — Toggle volume row + test button
══════════════════════════════════════════════ */
function toggleSoundVolume(enabled) {
  const row = $("soundVolumeRow");
  if (row) {
    row.style.opacity = enabled ? "1" : "0.45";
    row.style.pointerEvents = enabled ? "auto" : "none";
  }
}

let optionsAudioCtx = null;
function playTestSound() {
  const vol = Math.max(0.1, Math.min(1.2, Number($("soundVolume").value) / 100));

  // 1. Play directly in options page
  try {
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (AudioClass) {
      if (!optionsAudioCtx) optionsAudioCtx = new AudioClass();
      if (optionsAudioCtx.state === "suspended") {
        optionsAudioCtx.resume();
      }
      const ctx = optionsAudioCtx;
      const now = ctx.currentTime;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, now);
      compressor.knee.setValueAtTime(6, now);
      compressor.ratio.setValueAtTime(4, now);
      compressor.attack.setValueAtTime(0.002, now);
      compressor.release.setValueAtTime(0.06, now);
      compressor.connect(ctx.destination);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(vol, now);
      masterGain.connect(compressor);

      // Lead chime (triangle wave)
      const leadOsc = ctx.createOscillator();
      const leadGain = ctx.createGain();
      leadOsc.type = "triangle";
      leadOsc.frequency.setValueAtTime(784, now);
      leadOsc.frequency.exponentialRampToValueAtTime(1174, now + 0.05);
      leadGain.gain.setValueAtTime(0.001, now);
      leadGain.gain.linearRampToValueAtTime(0.85, now + 0.004);
      leadGain.gain.setValueAtTime(0.85, now + 0.025);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      leadOsc.connect(leadGain);
      leadGain.connect(masterGain);

      // Overtone shimmer (sine wave)
      const overtoneOsc = ctx.createOscillator();
      const overtoneGain = ctx.createGain();
      overtoneOsc.type = "sine";
      overtoneOsc.frequency.setValueAtTime(1568, now);
      overtoneOsc.frequency.exponentialRampToValueAtTime(2093, now + 0.05);
      overtoneGain.gain.setValueAtTime(0.001, now);
      overtoneGain.gain.linearRampToValueAtTime(0.45, now + 0.005);
      overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      overtoneOsc.connect(overtoneGain);
      overtoneGain.connect(masterGain);

      // Mechanical pop transient
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      popOsc.type = "sine";
      popOsc.frequency.setValueAtTime(650, now);
      popOsc.frequency.exponentialRampToValueAtTime(220, now + 0.035);
      popGain.gain.setValueAtTime(0.001, now);
      popGain.gain.linearRampToValueAtTime(0.70, now + 0.003);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      popOsc.connect(popGain);
      popGain.connect(masterGain);

      leadOsc.start(now);
      overtoneOsc.start(now);
      popOsc.start(now);
      leadOsc.stop(now + 0.19);
      overtoneOsc.stop(now + 0.16);
      popOsc.stop(now + 0.06);
    }
  } catch (err) {
    console.error("Local audio error:", err);
  }

  // 2. Also trigger via background offscreen engine as verification
  try {
    chrome.runtime?.sendMessage?.({ type: "PLAY_TEST_SOUND", soundVolume: vol }).catch(() => {});
  } catch {}
}

/* ══════════════════════════════════════════════
   SITE PREFERENCES
══════════════════════════════════════════════ */
async function saveSitePreference() {
  const raw    = $("siteDomain").value.trim().toLowerCase();
  const domain = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) return;
  const current         = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const sitePreferences = { ...current.sitePreferences, [domain]: $("sitePreference").value };
  await chrome.storage.local.set({ sitePreferences });
  $("siteDomain").value = "";
  renderSites(sitePreferences);
  showStatus(`Saved preference for ${domain}.`);
}

async function removeSite(domain) {
  const current         = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const sitePreferences = { ...current.sitePreferences };
  delete sitePreferences[domain];
  await chrome.storage.local.set({ sitePreferences });
  renderSites(sitePreferences);
  showStatus(`Removed ${domain}.`);
}

const PREF_LABEL = { auto: "Automatic", search: "Search field", chat: "Chat / writing" };

function renderSites(sitePreferences) {
  const list = $("siteList");
  list.replaceChildren();
  for (const [domain, pref] of Object.entries(sitePreferences || {}).sort()) {
    const item = document.createElement("li");
    const info = document.createElement("span");
    const ds = document.createElement("span");
    ds.className = "site-domain"; ds.textContent = domain;
    const ps = document.createElement("span");
    ps.className = "site-pref"; ps.textContent = PREF_LABEL[pref] || pref;
    info.append(ds, " — ", ps);
    const btn = document.createElement("button");
    btn.textContent = "Remove"; btn.type = "button";
    btn.addEventListener("click", () => removeSite(domain));
    item.append(info, btn);
    list.append(item);
  }
}

/* ══════════════════════════════════════════════
   AUTO-FOCUS SITES
══════════════════════════════════════════════ */
async function addAutoFocusSite() {
  const raw    = $("autoFocusDomain").value.trim().toLowerCase();
  const domain = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) return;
  const current = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const sites   = [...new Set([...(current.autoFocusSites || []), domain])];
  await chrome.storage.local.set({ autoFocusSites: sites });
  $("autoFocusDomain").value = "";
  renderAutoFocusSites(sites);
  showStatus(`Auto-focus enabled for ${domain}.`);
}

async function removeAutoFocusSite(domain) {
  const current = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const sites   = (current.autoFocusSites || []).filter((s) => s !== domain);
  await chrome.storage.local.set({ autoFocusSites: sites });
  renderAutoFocusSites(sites);
  showStatus(`Removed auto-focus for ${domain}.`);
}

function renderAutoFocusSites(sites) {
  const list = $("autoFocusList");
  list.replaceChildren();
  for (const domain of [...(sites || [])].sort()) {
    const item = document.createElement("li");
    const ds = document.createElement("span");
    ds.className = "site-domain"; ds.textContent = domain;
    const btn = document.createElement("button");
    btn.textContent = "Remove"; btn.type = "button";
    btn.addEventListener("click", () => removeAutoFocusSite(domain));
    item.append(ds, btn);
    list.append(item);
  }
}

/* ══════════════════════════════════════════════
   CUSTOM CSS SELECTORS
══════════════════════════════════════════════ */
async function saveCustomSelector() {
  const raw    = $("selectorDomain").value.trim().toLowerCase();
  const domain = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const sel    = $("selectorValue").value.trim();
  if (!domain || !sel) return;

  // Validate selector syntax
  try { document.querySelector(sel); } catch {
    showStatus(`Invalid CSS selector: ${sel}`);
    return;
  }

  const current        = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const customSelectors = { ...current.customSelectors, [domain]: sel };
  await chrome.storage.local.set({ customSelectors });
  $("selectorDomain").value = "";
  $("selectorValue").value  = "";
  renderSelectors(customSelectors);
  showStatus(`Saved selector for ${domain}.`);
}

async function removeSelector(domain) {
  const current        = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const customSelectors = { ...current.customSelectors };
  delete customSelectors[domain];
  await chrome.storage.local.set({ customSelectors });
  renderSelectors(customSelectors);
  showStatus(`Removed selector for ${domain}.`);
}

function renderSelectors(customSelectors) {
  const list = $("selectorList");
  list.replaceChildren();
  for (const [domain, sel] of Object.entries(customSelectors || {}).sort()) {
    const item = document.createElement("li");
    const info = document.createElement("span");
    const ds = document.createElement("span");
    ds.className = "site-domain"; ds.textContent = domain;
    const ss = document.createElement("code");
    ss.className = "site-selector"; ss.textContent = sel;
    info.append(ds, " → ", ss);
    const btn = document.createElement("button");
    btn.textContent = "Remove"; btn.type = "button";
    btn.addEventListener("click", () => removeSelector(domain));
    item.append(info, btn);
    list.append(item);
  }
}

/* ══════════════════════════════════════════════
   STATS
══════════════════════════════════════════════ */
async function loadStats() {
  const today = new Date().toISOString().slice(0, 10);
  const data  = await chrome.storage.local.get({ focusToday: "", focusCount: 0 });
  const count = data.focusToday === today ? (data.focusCount || 0) : 0;
  const el    = $("todayCount");
  if (el) el.textContent = count;
}

/* ══════════════════════════════════════════════
   CURSOR RING + SPOTLIGHT
══════════════════════════════════════════════ */
function initCursor() {
  const spotlight = $("cursorSpotlight");
  const ring      = $("cursorRing");
  if (!spotlight || !ring) return;

  let mx = -500, my = -500, rx = -500, ry = -500;

  document.addEventListener("pointermove", (e) => {
    mx = e.clientX;
    my = e.clientY;
    spotlight.style.transform = `translate(${mx - 280}px, ${my - 280}px)`;
    spotlight.style.opacity   = "1";
    ring.style.opacity        = "1";
  }, { passive: true });

  document.addEventListener("pointerleave", () => {
    spotlight.style.opacity = "0";
    ring.style.opacity      = "0";
  });

  document.addEventListener("pointerdown", () => ring.classList.add("pressing"));
  document.addEventListener("pointerup",   () => ring.classList.remove("pressing"));

  (function animateRing() {
    rx += (mx - rx) * 0.14;
    ry += (my - ry) * 0.14;
    ring.style.transform = `translate(${rx - 15}px, ${ry - 15}px)`;
    requestAnimationFrame(animateRing);
  })();
}

/* ══════════════════════════════════════════════
   AMBIENT CANVAS (aurora + dot grid + particles)
══════════════════════════════════════════════ */
function startAmbientCanvas() {
  const canvas = $("ambientCanvas");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");
  let W = window.innerWidth, H = window.innerHeight, t = 0;
  const mouse = { x: -3000, y: -3000 };
  const ripples = [];

  const AURORA = [
    { baseY: 0.75, amp: 0.09, f: 0.0042, spd: 0.00022, c: [28,90,12],   op: 0.28, hgt: 0.55 },
    { baseY: 0.62, amp: 0.11, f: 0.0055, spd: 0.00030, c: [55,155,18],  op: 0.22, hgt: 0.45 },
    { baseY: 0.50, amp: 0.10, f: 0.0068, spd: 0.00038, c: [88,200,22],  op: 0.18, hgt: 0.38 },
    { baseY: 0.38, amp: 0.08, f: 0.0082, spd: 0.00048, c: [140,240,28], op: 0.14, hgt: 0.30 },
    { baseY: 0.28, amp: 0.07, f: 0.0096, spd: 0.00060, c: [183,255,60], op: 0.10, hgt: 0.22 },
    { baseY: 0.18, amp: 0.05, f: 0.0120, spd: 0.00075, c: [220,255,120],op: 0.06, hgt: 0.16 },
  ];

  const COUNT = 80;
  let particles = [];

  function makeParticle() {
    return {
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
      baseR: Math.random() * 1.6 + 0.4, r: 1,
      phase: Math.random() * Math.PI * 2,
    };
  }
  function initP() { particles = Array.from({ length: COUNT }, makeParticle); }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const GS = 38, GI = 180;
  function drawDotGrid() {
    for (let gx = GS / 2; gx < W; gx += GS) {
      for (let gy = GS / 2; gy < H; gy += GS) {
        const dist = Math.hypot(gx - mouse.x, gy - mouse.y);
        const prox = Math.max(0, 1 - dist / GI);
        const r = 0.9 + prox * 3.2, a = 0.055 + prox * 0.32;
        if (prox > 0.05) {
          const grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * 5);
          grd.addColorStop(0, `rgba(183,255,60,${a * 0.6})`);
          grd.addColorStop(1, `rgba(183,255,60,0)`);
          ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(gx, gy, r * 5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(183,255,60,${a})`; ctx.fill();
      }
    }
  }

  function waveY(layer, x, absY) {
    const mdist = Math.hypot(x - mouse.x, absY - mouse.y);
    const pull  = mdist < 260 ? (1 - mdist / 260) * 55 : 0;
    return absY
      + Math.sin(x * layer.f + t * layer.spd) * layer.amp * H
      + Math.sin(x * layer.f * 1.72 + t * layer.spd * 1.6 + 1.1) * layer.amp * H * 0.38
      + Math.sin(x * layer.f * 3.10 + t * layer.spd * 0.9 + 2.4) * layer.amp * H * 0.14
      - pull;
  }
  function drawAurora() {
    const STEP = 5;
    for (const layer of AURORA) {
      const absY = layer.baseY * H;
      const [r, g, b] = layer.c;
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + STEP; x += STEP) {
        const y = waveY(layer, x, absY);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(W + STEP, H); ctx.lineTo(0, H); ctx.closePath();
      const pk = absY - layer.amp * H;
      const grad = ctx.createLinearGradient(0, pk - 10, 0, pk + layer.hgt * H);
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(0.05, `rgba(${r},${g},${b},${layer.op})`);
      grad.addColorStop(0.25, `rgba(${r},${g},${b},${layer.op * 0.55})`);
      grad.addColorStop(0.60, `rgba(${r},${g},${b},${layer.op * 0.18})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath();
      for (let x = 0; x <= W; x += STEP) { const y = waveY(layer, x, absY); if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.strokeStyle = `rgba(${r},${g},${b},${layer.op * 2})`; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }

  function drawCursorGlow() {
    if (mouse.x < -1000) return;
    const grd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 280);
    grd.addColorStop(0, "rgba(183,255,60,0.07)"); grd.addColorStop(0.35, "rgba(183,255,60,0.025)"); grd.addColorStop(1, "rgba(183,255,60,0)");
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 280, 0, Math.PI * 2); ctx.fill();
  }

  function spawnRipple(x, y) {
    ripples.push({ x, y, r: 4, maxR: Math.min(W, H) * 0.30, op: 0.80, spd: 5.5 });
    setTimeout(() => ripples.push({ x, y, r: 4, maxR: Math.min(W, H) * 0.16, op: 0.50, spd: 4.0 }), 90);
  }
  function drawRipples() {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i]; rp.r += rp.spd; rp.spd *= 0.975; rp.op *= 0.935;
      if (rp.r >= rp.maxR || rp.op < 0.01) { ripples.splice(i, 1); continue; }
      ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(183,255,60,${rp.op * 0.55})`; ctx.lineWidth = 1.5; ctx.stroke();
      const grd = ctx.createRadialGradient(rp.x, rp.y, 0, rp.x, rp.y, rp.r);
      grd.addColorStop(0.75, `rgba(183,255,60,0)`); grd.addColorStop(1, `rgba(183,255,60,${rp.op * 0.07})`);
      ctx.fillStyle = grd; ctx.fill();
    }
  }

  const RR = 90, AR = 290, RF = 0.60, AF = 0.015, VF = 0.008, MS = 7, FR = 0.962, LD = 125;
  function updateP() {
    for (const p of particles) {
      const dx = mouse.x - p.x, dy = mouse.y - p.y, dist = Math.hypot(dx, dy) || 0.001;
      const ndx = dx / dist, ndy = dy / dist;
      if (dist < RR) { const f = (1 - dist / RR) * RF; p.vx -= ndx * f; p.vy -= ndy * f; }
      else if (dist < AR) { const r = (dist - RR) / (AR - RR), af = (1 - r) * AF, vf = (1 - r) * VF; p.vx += ndx * af + (-ndy) * vf; p.vy += ndy * af + ndx * vf; }
      const spd = Math.hypot(p.vx, p.vy); if (spd > MS) { p.vx = (p.vx / spd) * MS; p.vy = (p.vy / spd) * MS; }
      p.vx *= FR; p.vy *= FR; p.x += p.vx; p.y += p.vy;
      const pad = 30;
      if (p.x < -pad) p.x = W + pad; if (p.x > W + pad) p.x = -pad;
      if (p.y < -pad) p.y = H + pad; if (p.y > H + pad) p.y = -pad;
      const prox = Math.max(0, 1 - dist / AR);
      p.r = p.baseR * (1 + Math.sin(t * 0.018 + p.phase) * 0.18) + prox * 2.6;
    }
  }
  function drawConn() {
    for (let a = 0; a < particles.length; a++) {
      for (let b = a + 1; b < particles.length; b++) {
        const pa = particles[a], pb = particles[b], d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
        if (d >= LD) continue;
        const midX = (pa.x + pb.x) * 0.5, midY = (pa.y + pb.y) * 0.5;
        const mD = Math.hypot(midX - mouse.x, midY - mouse.y), mP = Math.max(0, 1 - mD / AR);
        const fade = 1 - d / LD, alpha = (0.06 + mP * 0.28) * fade;
        if (mP > 0.2) {
          const lg = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
          lg.addColorStop(0, `rgba(183,255,60,${alpha * 0.7})`); lg.addColorStop(0.5, `rgba(183,255,60,${alpha})`); lg.addColorStop(1, `rgba(183,255,60,${alpha * 0.7})`);
          ctx.strokeStyle = lg; ctx.lineWidth = 1 + mP * 0.9;
        } else { ctx.strokeStyle = `rgba(183,255,60,${alpha})`; ctx.lineWidth = 0.7; }
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      }
    }
  }
  function drawP() {
    for (const p of particles) {
      const dist = Math.hypot(mouse.x - p.x, mouse.y - p.y), prox = Math.max(0, 1 - dist / AR);
      if (prox > 0.15) {
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        grd.addColorStop(0, `rgba(183,255,60,${prox * 0.40})`); grd.addColorStop(0.4, `rgba(183,255,60,${prox * 0.12})`); grd.addColorStop(1, `rgba(183,255,60,0)`);
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(183,255,60,${0.28 + prox * 0.60})`; ctx.fill();
    }
  }

  function tick() {
    t++; ctx.clearRect(0, 0, W, H);
    drawDotGrid(); drawAurora(); drawCursorGlow(); drawRipples();
    updateP(); drawConn(); drawP();
    requestAnimationFrame(tick);
  }

  window.addEventListener("pointermove", (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    const px = (e.clientX / W - 0.5) * 2, py = (e.clientY / H - 0.5) * 2;
    document.documentElement.style.setProperty("--mx", `${px * 22}px`);
    document.documentElement.style.setProperty("--my", `${py * 22}px`);
  }, { passive: true });
  window.addEventListener("click", (e) => spawnRipple(e.clientX, e.clientY));
  window.addEventListener("resize", resize);
  initP(); resize(); tick();
}

/* ── Card 3-D tilt ── */
function initCardTilt() {
  document.querySelectorAll(".setting-card, .mini-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const rect = card.getBoundingClientRect();
      const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      card.style.transition = "border-color 220ms ease, box-shadow 220ms ease";
      card.style.transform  = `perspective(800px) rotateY(${dx * 3.5}deg) rotateX(${-dy * 3.5}deg) translateY(-4px)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transition = "transform 420ms cubic-bezier(0.22,1,0.36,1), border-color 220ms ease, box-shadow 220ms ease";
      card.style.transform  = "";
    });
  });
}

/* ══════════════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════════════ */
$("indicatorColor").addEventListener("change", saveSettings);
$("indicatorColor").addEventListener("input",  (e) => syncColor(e.target.value));
$("indicatorDuration").addEventListener("change", saveSettings);
$("indicatorDuration").addEventListener("input",  (e) => updateDurationLabel(e.target.value));
$("ignoreTiny").addEventListener("change",    saveSettings);
$("skipPasswords").addEventListener("change", saveSettings);
$("debugMode").addEventListener("change",     saveSettings);
$("slashToFocus").addEventListener("change",  saveSettings);
$("escapeToBlur").addEventListener("change",  saveSettings);
$("soundEnabled").addEventListener("change",  saveSettings);
$("soundVolume").addEventListener("change",   saveSettings);
$("soundVolume").addEventListener("input",    (e) => updateVolumeLabel(e.target.value));
$("testSound").addEventListener("click",      playTestSound);
$("saveSite").addEventListener("click",       saveSitePreference);
$("siteDomain").addEventListener("keydown",   (e) => { if (e.key === "Enter") saveSitePreference(); });
$("addAutoFocus").addEventListener("click",   addAutoFocusSite);
$("autoFocusDomain").addEventListener("keydown", (e) => { if (e.key === "Enter") addAutoFocusSite(); });
$("saveSelector").addEventListener("click",   saveCustomSelector);
$("selectorDomain").addEventListener("keydown",  (e) => { if (e.key === "Enter") saveCustomSelector(); });
$("selectorValue").addEventListener("keydown",   (e) => { if (e.key === "Enter") saveCustomSelector(); });

/* ── Init ── */
loadSettings();
startAmbientCanvas();
initCursor();
initCardTilt();
