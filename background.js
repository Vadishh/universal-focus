const DEBUG = false;

function log(...args) {
  if (DEBUG) console.debug("[Universal Focus]", ...args);
}

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
