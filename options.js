const DEFAULT_SETTINGS = {
  indicatorColor: "#6d5dfc",
  indicatorDuration: 900,
  ignoreTiny: true,
  skipPasswords: true,
  sitePreferences: {}
};

const $ = (id) => document.getElementById(id);

async function loadSettings() {
  const settings = { ...DEFAULT_SETTINGS, ...(await chrome.storage.local.get(DEFAULT_SETTINGS)) };
  $("indicatorColor").value = settings.indicatorColor;
  $("indicatorDuration").value = settings.indicatorDuration;
  $("ignoreTiny").checked = settings.ignoreTiny;
  $("skipPasswords").checked = settings.skipPasswords;
  renderSites(settings.sitePreferences);
}

async function saveSettings() {
  const current = await chrome.storage.local.get(DEFAULT_SETTINGS);
  await chrome.storage.local.set({
    ...current,
    indicatorColor: $("indicatorColor").value,
    indicatorDuration: Math.min(5000, Math.max(100, Number($("indicatorDuration").value) || 900)),
    ignoreTiny: $("ignoreTiny").checked,
    skipPasswords: $("skipPasswords").checked
  });
  $("status").textContent = "Settings saved.";
  setTimeout(() => { $("status").textContent = ""; }, 1800);
}

async function saveSitePreference() {
  const domain = $("siteDomain").value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) return;
  const current = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const sitePreferences = { ...current.sitePreferences, [domain]: $("sitePreference").value };
  await chrome.storage.local.set({ sitePreferences });
  $("siteDomain").value = "";
  renderSites(sitePreferences);
  $("status").textContent = `Saved preference for ${domain}.`;
}

async function removeSite(domain) {
  const current = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const sitePreferences = { ...current.sitePreferences };
  delete sitePreferences[domain];
  await chrome.storage.local.set({ sitePreferences });
  renderSites(sitePreferences);
}

function renderSites(sitePreferences) {
  const list = $("siteList");
  list.replaceChildren();
  for (const [domain, preference] of Object.entries(sitePreferences || {}).sort()) {
    const item = document.createElement("li");
    item.textContent = `${domain}: ${preference}`;
    const button = document.createElement("button");
    button.textContent = "Remove";
    button.addEventListener("click", () => removeSite(domain));
    item.append(button);
    list.append(item);
  }
}

$("indicatorColor").addEventListener("change", saveSettings);
$("indicatorDuration").addEventListener("change", saveSettings);
$("ignoreTiny").addEventListener("change", saveSettings);
$("skipPasswords").addEventListener("change", saveSettings);
$("saveSite").addEventListener("click", saveSitePreference);
loadSettings();
