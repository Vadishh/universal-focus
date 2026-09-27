const DEBUG = false;

function log(...args) {
  if (DEBUG) console.debug("[Universal Focus]", ...args);
}

/* ══════════════════════════════════════════════
   Onboarding — open once on first install
══════════════════════════════════════════════ */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});

/* ══════════════════════════════════════════════
   Offscreen Audio Engine (MV3 Reliable Playback)
══════════════════════════════════════════════ */
let creatingOffscreenPromise = null;

async function ensureOffscreenDocument() {
  try {
    if (await chrome.offscreen.hasDocument()) return;
    if (creatingOffscreenPromise) {
      await creatingOffscreenPromise;
      return;
    }
    creatingOffscreenPromise = chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play audible feedback when fields are focused"
    });
    await creatingOffscreenPromise;
    creatingOffscreenPromise = null;
  } catch (err) {
    creatingOffscreenPromise = null;
    log("Could not ensure offscreen document", err);
  }
}

async function playFocusSound(volume = 0.85) {
  try {
    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({ type: "PLAY_AUDIO", volume });
  } catch (err) {
    log("Offscreen audio playback failed", err);
  }
}

/* ══════════════════════════════════════════════
   Keyboard command handler
══════════════════════════════════════════════ */
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "focus-best-field") return;

  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];
    if (!tab?.id) return;

    await chrome.tabs.sendMessage(tab.id, { type: "FOCUS_BEST_FIELD" });
  } catch (error) {
    // Restricted pages such as chrome:// pages do not accept content-script messages.
    log("Could not contact the active tab", error);
  }
});

/* ══════════════════════════════════════════════
   Focus stats badge
   - Content script sends { type: "FOCUS_PERFORMED" }
   - We increment a daily counter and update the badge
══════════════════════════════════════════════ */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function incrementFocusCount() {
  const today = todayKey();
  const data = await chrome.storage.local.get({ focusToday: "", focusCount: 0 });

  let count;
  if (data.focusToday === today) {
    count = (data.focusCount || 0) + 1;
  } else {
    count = 1;
  }

  await chrome.storage.local.set({ focusToday: today, focusCount: count });
  updateBadge(count);
}

function updateBadge(count) {
  const text = count > 0 ? String(count) : "";
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: "#1a2e08" });
  chrome.action.setBadgeTextColor({ color: "#b7ff3c" });
}

async function refreshBadge() {
  const today = todayKey();
  const data = await chrome.storage.local.get({ focusToday: "", focusCount: 0 });
  if (data.focusToday !== today) {
    await chrome.storage.local.set({ focusToday: today, focusCount: 0 });
    updateBadge(0);
  } else {
    updateBadge(data.focusCount || 0);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "FOCUS_PERFORMED") {
    incrementFocusCount();
    if (message.playSound) {
      playFocusSound(message.soundVolume);
    }
    sendResponse({ ok: true });
  } else if (message?.type === "PLAY_TEST_SOUND") {
    playFocusSound(message.soundVolume);
    sendResponse({ ok: true });
  }
});

// Refresh badge on startup
refreshBadge();
