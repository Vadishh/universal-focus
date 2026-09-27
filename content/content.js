(function universalFocusContent(global) {
  "use strict";

  const DEBUG = false;
  const DEFAULT_SETTINGS = {
    indicatorColor: "#b7ff3c",
    indicatorDuration: 1200,
    ignoreTiny: true,
    skipPasswords: true,
    enabled: true,
    debugMode: false,
    sitePreferences: {},
    autoFocusSites: [],
    slashToFocus: true,
    escapeToBlur: true,
    soundEnabled: true,
    soundVolume: 0.85,
    customSelectors: {}
  };
  let settings = { ...DEFAULT_SETTINGS };
  let indicatorTimer;
  let hasAutoFocused = false;

  /* ── Settings ── */
  if (global.chrome?.storage?.local) {
    global.chrome.storage.local.get(DEFAULT_SETTINGS).then((stored) => {
      settings = { ...DEFAULT_SETTINGS, ...stored };
      maybeAutoFocus();
    }).catch(() => {});
    global.chrome.storage.onChanged?.addListener((changes) => {
      for (const [key, change] of Object.entries(changes)) settings[key] = change.newValue;
    });
  }

  function log(...args) {
    if (DEBUG) console.debug("[Universal Focus]", ...args);
  }

  /* ── Sound feedback (Web Audio API with Offscreen Fallback) ── */
  let localAudioCtx = null;
  function playFocusSound() {
    if (!settings.soundEnabled) return false;
    try {
      const AudioClass = global.AudioContext || global.webkitAudioContext;
      if (!AudioClass) return false;
      if (!localAudioCtx) localAudioCtx = new AudioClass();
      if (localAudioCtx.state === "suspended") {
        localAudioCtx.resume();
      }
      if (localAudioCtx.state === "running") {
        const ctx = localAudioCtx;
        const now = ctx.currentTime;
        const vol = Math.max(0.1, Math.min(1.2, Number(settings.soundVolume) || 0.85));

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

        // Lead chime
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

        // Overtone shimmer
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
        return true;
      }
    } catch {}
    return false;
  }

  /* ── Report focus to background for stats badge & guaranteed audio fallback ── */
  function reportFocus(playedLocally = false) {
    try {
      global.chrome?.runtime?.sendMessage?.({
        type: "FOCUS_PERFORMED",
        playSound: Boolean(settings.soundEnabled && !playedLocally),
        soundVolume: Number(settings.soundVolume) || 0.85
      }).catch(() => {});
    } catch {}
  }

  /* ── Indicator ── */
  function showIndicator(element) {
    if (!element) return;
    element.style.setProperty("--universal-focus-color", settings.indicatorColor || DEFAULT_SETTINGS.indicatorColor);
    element.classList.add("universal-focus-target");
    clearTimeout(indicatorTimer);
    indicatorTimer = setTimeout(() => element.classList.remove("universal-focus-target"),
      Number(settings.indicatorDuration) || DEFAULT_SETTINGS.indicatorDuration);
  }

  /* ── Google special-case ── */
  function findGoogleSearchField() {
    if (!/google\./i.test(global.location.hostname)) return null;

    const selectors = [
      "textarea[name='q']",
      "input[name='q']",
      "textarea[aria-label='Search']",
      "input[aria-label='Search']",
      "textarea[title='Search']",
      "input[title='Search']"
    ];

    for (const selector of selectors) {
      const element = global.document.querySelector(selector);
      if (!element || element.disabled || element.readOnly) continue;
      const style = global.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display !== "none" && style.visibility !== "hidden" &&
          rect.width > 0 && rect.height > 0) {
        return element;
      }
    }
    return null;
  }

  /* ── Custom selector per site ── */
  function findCustomSelectorField() {
    const hostname = global.location.hostname.toLowerCase();
    const sel = settings.customSelectors?.[hostname];
    if (!sel) return null;
    try {
      const element = global.document.querySelector(sel);
      if (!element) return null;
      const style = global.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden") return null;
      if (rect.width <= 0 || rect.height <= 0) return null;
      if (element.disabled || element.getAttribute("aria-disabled") === "true") return null;
      return element;
    } catch {
      return null; // Invalid selector
    }
  }

  function isSearchCandidate(candidate) {
    const element = candidate?.element || candidate;
    if (!element) return false;
    const metadata = candidate?.metadata || {};
    const searchable = [
      element.type,
      element.name,
      element.id,
      element.getAttribute?.("placeholder"),
      element.getAttribute?.("aria-label"),
      element.getAttribute?.("title")
    ].filter(Boolean).join(" ").toLowerCase();
    return element.type === "search" || element.name === "q" || element.id === "q" ||
      metadata.type === "search" || /search|query|find/.test(searchable);
  }

  function selectSearchText(element) {
    if (!isSearchCandidate(element)) return;
    if (typeof element.select === "function") {
      element.select();
      return;
    }
    if (!element.isContentEditable) return;
    const selection = global.getSelection();
    const range = global.document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function describeCandidate(candidate) {
    const metadata = candidate.metadata;
    return [
      metadata.type,
      metadata.role,
      metadata.placeholder,
      metadata.ariaLabel,
      metadata.name,
      metadata.id
    ].filter(Boolean).join(" | ") || "unnamed editable field";
  }

  function showDebugPanel(allCandidates, rankedCandidates, selected) {
    if (!settings.debugMode) return;

    document.getElementById("universal-focus-debug")?.remove();
    const panel = document.createElement("aside");
    panel.id = "universal-focus-debug";
    panel.style.cssText = [
      "position:fixed", "z-index:2147483647", "top:12px", "right:12px", "width:360px",
      "max-height:80vh", "overflow:auto", "padding:14px", "border:1px solid #c8c4ff",
      "border-radius:10px", "background:#fff", "box-shadow:0 8px 30px rgba(0,0,0,.2)",
      "color:#202124", "font:12px/1.4 system-ui,sans-serif"
    ].join(";");

    const header = document.createElement("div");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:700";
    header.textContent = `Universal Focus debug (${allCandidates.length} detected)`;
    const close = document.createElement("button");
    close.textContent = "×";
    close.setAttribute("aria-label", "Close debug panel");
    close.style.cssText = "border:0;background:transparent;font-size:20px;cursor:pointer";
    close.addEventListener("click", () => panel.remove());
    header.append(close);
    panel.append(header);

    const selectedText = document.createElement("div");
    selectedText.textContent = selected ? `Selected: ${describeCandidate(selected)}` : "Selected: none";
    selectedText.style.cssText = "margin-bottom:10px;color:#5146cf;font-weight:600";
    panel.append(selectedText);

    allCandidates.forEach((candidate, index) => {
      const eligible = rankedCandidates.includes(candidate);
      const item = document.createElement("div");
      item.style.cssText = `padding:7px 0;border-top:1px solid #eee;color:${eligible ? "#202124" : "#777"}`;
      item.textContent = `${index + 1}. ${describeCandidate(candidate)} — score ${candidate.adjustedScore ?? candidate.score}${eligible ? "" : " — excluded"}`;
      if (candidate === selected) item.style.fontWeight = "700";
      panel.append(item);
    });
    document.documentElement.append(panel);
  }

  /* ── Core: Focus best field ── */
  function focusBestField(mode = "best") {
    if (!settings.enabled) {
      return { focused: false, reason: "disabled" };
    }

    const active = global.document.activeElement;

    // 1. Try custom CSS selector first
    const customField = findCustomSelectorField();
    if (customField && customField !== active) {
      customField.focus({ preventScroll: true });
      selectSearchText(customField);
      showIndicator(customField);
      const played = playFocusSound();
      reportFocus(played);
      log("Focused custom selector field", customField);
      return { focused: true, reason: "custom-selector", element: customField };
    }

    // 2. Normal detection flow
    const hostname = global.location.hostname.toLowerCase();
    const preference = mode === "best" ? (settings.sitePreferences?.[hostname] || "auto") : mode;
    const candidates = global.UniversalFocusDetector.rankCandidates({
      preference,
      ignoreTiny: settings.ignoreTiny,
      skipPasswords: settings.skipPasswords
    });
    const googleField = mode !== "chat" && preference === "auto" ? findGoogleSearchField() : null;
    let candidate = googleField ? { element: googleField, score: 999 } : candidates[0];
    const activeIndex = candidates.findIndex((item) => item.element === active);
    if (activeIndex >= 0 && candidates.length > 1) {
      candidate = candidates[(activeIndex + 1) % candidates.length];
    }
    if (!candidate) {
      showDebugPanel(global.UniversalFocusDetector.getCandidates(), candidates, null);
      log("No suitable editable field found");
      return { focused: false, reason: "no-candidate" };
    }

    candidate.element.focus({ preventScroll: true });
    selectSearchText(candidate);
    showIndicator(candidate.element);
    showDebugPanel(global.UniversalFocusDetector.getCandidates(), candidates, candidate);
    const played = playFocusSound();
    reportFocus(played);
    log("Focused candidate", candidate.score, candidate.element);
    return { focused: true, reason: "focused", element: candidate.element };
  }

  /* ── Auto-focus on page load ── */
  function maybeAutoFocus() {
    if (hasAutoFocused) return;
    hasAutoFocused = true;
    if (!settings.enabled) return;

    const hostname = global.location.hostname.toLowerCase();
    const sites = settings.autoFocusSites || [];
    const match = sites.some((s) => hostname === s || hostname.endsWith("." + s));
    if (!match) return;

    // Short delay for page to settle (SPAs, lazy elements)
    setTimeout(() => {
      focusBestField("best");
      log("Auto-focused on page load for", hostname);
    }, 350);
  }

  /* ── Slash-to-focus ── */
  function isEditableActive() {
    const el = global.document.activeElement;
    if (!el || el === global.document.body || el === global.document.documentElement) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return true;
    if (el.isContentEditable) return true;
    if (el.getAttribute("role") === "textbox") return true;
    return false;
  }

  global.document.addEventListener("keydown", (e) => {
    if (!settings.enabled) return;

    // Slash-to-focus: "/" when no field is focused
    if (settings.slashToFocus && e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!isEditableActive()) {
        e.preventDefault();
        e.stopPropagation();
        focusBestField("search");
      }
    }

    // Escape-to-blur: blur focused field and return keyboard to page
    if (settings.escapeToBlur && e.key === "Escape" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (isEditableActive()) {
        global.document.activeElement.blur();
        log("Escape-to-blur: blurred active field");
      }
    }
  }, true);

  /* ── Message listener ── */
  global.chrome?.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
    const actions = {
      FOCUS_BEST_FIELD: "best",
      FOCUS_SEARCH_FIELD: "search",
      FOCUS_CHAT_FIELD: "chat"
    };
    if (!actions[message?.type]) return;
    const result = focusBestField(actions[message.type]);
    sendResponse({ focused: result.focused, reason: result.reason });
  });

  global.UniversalFocusContent = { focusBestField };
})(window);
