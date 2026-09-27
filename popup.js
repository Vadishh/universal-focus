const DEFAULT_SETTINGS = { enabled: true };
const $ = (id) => document.getElementById(id);

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0];
}

async function runFocusAction(action) {
  const status = $("status");
  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active tab");
    await chrome.tabs.sendMessage(tab.id, { type: action });
    window.close();
  } catch {
    status.textContent = "This page doesn't allow extensions.";
    status.classList.add("error");
    setTimeout(() => { status.textContent = ""; status.classList.remove("error"); }, 2500);
  }
}

async function loadState() {
  const settings = { ...DEFAULT_SETTINGS, ...(await chrome.storage.local.get(DEFAULT_SETTINGS)) };
  applyToggleState(settings.enabled);
  const tab = await getActiveTab();
  $("pageName").textContent = tab?.title || "Current page";
}

function applyToggleState(enabled) {
  const btn = $("toggleEnabled");
  btn.textContent = "";
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.textContent = "●";
  btn.appendChild(dot);
  btn.appendChild(document.createTextNode(enabled ? " Enabled" : " Disabled"));
  btn.className = `text-btn ${enabled ? "is-enabled" : "is-disabled"}`;
}

async function toggleEnabled() {
  const settings = { ...DEFAULT_SETTINGS, ...(await chrome.storage.local.get(DEFAULT_SETTINGS)) };
  const enabled = !settings.enabled;
  await chrome.storage.local.set({ enabled });
  applyToggleState(enabled);
  const status = $("status");
  status.textContent = enabled ? "Extension enabled." : "Extension disabled.";
  status.classList.remove("error");
  setTimeout(() => { status.textContent = ""; }, 2000);
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => runFocusAction(button.dataset.action));
});
$("toggleEnabled").addEventListener("click", toggleEnabled);
$("openSettings").addEventListener("click", () => chrome.runtime.openOptionsPage());
loadState();
