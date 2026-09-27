/**
 * Universal Focus — Onboarding Controller
 * Handles platform modifier keys, interactive shortcut test feedback,
 * ambient cursor spotlight, and tab / options navigation.
 */
(function universalFocusOnboarding() {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const btnGetStarted = $("btnGetStarted");
  const btnOpenSettings = $("btnOpenSettings");
  const cursorSpotlight = $("cursorSpotlight");
  const interactivePill = $("interactivePill");
  const interactiveText = $("interactiveText");
  const modKey = $("modKey");

  const cardBestField = $("cardBestField");
  const cardSlash = $("cardSlash");
  const cardEscape = $("cardEscape");

  let pillResetTimer = null;
  let audioCtx = null;

  /* ══════════════════════════════════════════════
     PLATFORM DETECTION (Mac Cmd vs Windows/Linux Ctrl)
     ══════════════════════════════════════════════ */
  const isMac = (() => {
    try {
      if (navigator.userAgentData?.platform) {
        return /mac/i.test(navigator.userAgentData.platform);
      }
      return /mac/i.test(navigator.platform || navigator.userAgent);
    } catch {
      return false;
    }
  })();

  if (isMac && modKey) {
    modKey.textContent = "Cmd";
    modKey.setAttribute("title", "Command key on macOS");
    const cluster = modKey.closest(".kbd-cluster");
    if (cluster) {
      cluster.setAttribute("aria-label", "Shortcut: Command plus Shift plus Space");
    }
  }

  /* ══════════════════════════════════════════════
     SUBTLE AUDIO FEEDBACK (Synthesized Web Audio)
     Matches the extension's native sound signature
     ══════════════════════════════════════════════ */
  function playTickSound(isBlur = false) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = "sine";
      if (!isBlur) {
        // Ascending focus chirp: 784 Hz -> 1046 Hz
        osc.frequency.setValueAtTime(784, now);
        osc.frequency.exponentialRampToValueAtTime(1046, now + 0.05);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.24, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      } else {
        // Descending blur tick: 960 Hz -> 520 Hz
        osc.frequency.setValueAtTime(960, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.05);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.20, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      }

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Audio might be blocked until user gesture or disabled
    }
  }

  /* ══════════════════════════════════════════════
     INTERACTIVE FEEDBACK TRIGGER
     ══════════════════════════════════════════════ */
  function triggerCardHighlight(cardElement, message, isBlur = false) {
    if (!cardElement) return;

    cardElement.classList.add("is-triggered");
    setTimeout(() => {
      cardElement.classList.remove("is-triggered");
    }, 450);

    playTickSound(isBlur);

    if (interactivePill && interactiveText && message) {
      clearTimeout(pillResetTimer);
      interactiveText.innerHTML = `<strong>Active:</strong> ${message}`;
      interactivePill.classList.add("highlight");

      pillResetTimer = setTimeout(() => {
        interactivePill.classList.remove("highlight");
        interactiveText.innerHTML = `Try pressing <kbd class="key-inline">/</kbd> or <kbd class="key-inline">Esc</kbd> to test shortcuts`;
      }, 2000);
    }
  }

  /* ══════════════════════════════════════════════
     KEYBOARD EVENT LISTENERS FOR SHORTCUT TESTING
     ══════════════════════════════════════════════ */
  window.addEventListener("keydown", (e) => {
    // 1. Ctrl+Shift+Space (or Cmd+Shift+Space on Mac)
    const modPressed = isMac ? e.metaKey : e.ctrlKey;
    if (modPressed && e.shiftKey && (e.code === "Space" || e.key === " ")) {
      e.preventDefault();
      triggerCardHighlight(cardBestField, `${isMac ? "Cmd" : "Ctrl"}+Shift+Space — Focused smartest field!`, false);
      return;
    }

    // 2. Slash key (/)
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      triggerCardHighlight(cardSlash, `Slash (/) — Instant jump to search!`, false);
      return;
    }

    // 3. Escape key (Esc)
    if (e.key === "Escape") {
      triggerCardHighlight(cardEscape, `Esc — Unfocused & returned to page!`, true);
      return;
    }
  });

  // Also support clicking cards directly to test feedback
  cardBestField?.addEventListener("click", () => {
    triggerCardHighlight(cardBestField, `${isMac ? "Cmd" : "Ctrl"}+Shift+Space — Focused smartest field!`, false);
  });
  cardSlash?.addEventListener("click", () => {
    triggerCardHighlight(cardSlash, `Slash (/) — Instant jump to search!`, false);
  });
  cardEscape?.addEventListener("click", () => {
    triggerCardHighlight(cardEscape, `Esc — Unfocused & returned to page!`, true);
  });

  /* ══════════════════════════════════════════════
     CURSOR SPOTLIGHT (SMOOTH MOUSE TRACKING)
     ══════════════════════════════════════════════ */
  if (cursorSpotlight) {
    let ticking = false;
    window.addEventListener("mousemove", (e) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          cursorSpotlight.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ══════════════════════════════════════════════
     BUTTON ACTIONS
     ══════════════════════════════════════════════ */

  // 1. "Get Started" -> closes the tab
  function handleGetStarted() {
    if (typeof chrome !== "undefined" && chrome?.tabs?.getCurrent) {
      chrome.tabs.getCurrent((tab) => {
        if (tab?.id) {
          chrome.tabs.remove(tab.id);
        } else {
          window.close();
        }
      });
    } else {
      window.close();
    }
  }

  // 2. "Open Settings" -> opens chrome.runtime.openOptionsPage()
  function handleOpenSettings() {
    if (typeof chrome !== "undefined" && chrome?.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage(() => {
        if (chrome.runtime?.lastError) {
          window.location.href = "options.html";
        }
      });
    } else {
      window.location.href = "options.html";
    }
  }

  btnGetStarted?.addEventListener("click", handleGetStarted);
  btnOpenSettings?.addEventListener("click", handleOpenSettings);

})();
