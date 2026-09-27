(function universalFocusDetector(global) {
  "use strict";

  const selector = [
    "input:not([type='password']):not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset']):not([type='checkbox']):not([type='radio'])",
    "textarea",
    "[contenteditable]:not([contenteditable='false'])",
    "[role='textbox']"
  ].join(",");

  function isVisible(element) {
    const style = global.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" &&
      style.opacity !== "0" && rect.width > 0 && rect.height > 0;
  }

  function isEditable(element) {
    const tag = element.tagName?.toLowerCase();
    const type = (element.getAttribute("type") || "").toLowerCase();
    return element.isContentEditable || element.getAttribute("contenteditable") === "true" ||
      element.getAttribute("role") === "textbox" ||
      ((tag === "input" || tag === "textarea") && !["password", "hidden", "button", "submit", "reset"].includes(type));
  }

  function collectOpenShadowRoots(root, elements) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll("*").forEach((element) => {
      if (element.shadowRoot) {
        elements.push(...element.shadowRoot.querySelectorAll(selector));
        collectOpenShadowRoots(element.shadowRoot, elements);
      }
    });
  }

  function getContext(element) {
    const parent = element.closest?.("form, section, main, article, dialog, header, nav") || element.parentElement;
    return [
      parent?.innerText,
      parent?.getAttribute?.("aria-label"),
      parent?.getAttribute?.("role")
    ].filter(Boolean).join(" ").slice(0, 500);
  }

  function makeCandidate(element, hasViewportCandidate) {
    const rect = element.getBoundingClientRect();
    const style = global.getComputedStyle(element);
    const tag = element.tagName?.toLowerCase();
    const type = (element.getAttribute("type") || tag || "").toLowerCase();
    const editable = isEditable(element);
    const visible = isVisible(element);
    const enabled = !element.disabled && element.getAttribute("aria-disabled") !== "true" &&
      element.getAttribute("aria-hidden") !== "true" && !element.readOnly;
    const inViewport = rect.bottom > 0 && rect.right > 0 && rect.top < global.innerHeight && rect.left < global.innerWidth;
    const metadata = {
      type,
      role: element.getAttribute("role") || "",
      placeholder: element.getAttribute("placeholder") || "",
      ariaLabel: element.getAttribute("aria-label") || "",
      name: element.getAttribute("name") || "",
      id: element.id || "",
      context: getContext(element),
      visible,
      enabled,
      editable,
      contentEditable: element.isContentEditable || element.getAttribute("contenteditable") === "true",
      isPassword: type === "password",
      inViewport,
      hasViewportCandidate,
      width: rect.width,
      height: rect.height,
      isNearTop: rect.top >= 0 && rect.top < global.innerHeight * 0.35,
      isPrimaryLike: style.position === "fixed" || style.position === "sticky"
    };
    return { element, metadata, score: global.UniversalFocusScorer.scoreCandidate({ metadata }) };
  }

  function getCandidates() {
    const elements = Array.from(global.document.querySelectorAll(selector));
    collectOpenShadowRoots(global.document, elements);
    const unique = [...new Set(elements)];
    const preliminary = unique.filter((element) => isEditable(element));
    const hasViewportCandidate = preliminary.some((element) => isVisible(element) && (() => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.right > 0 && rect.top < global.innerHeight && rect.left < global.innerWidth;
    })());
    return preliminary.map((element) => makeCandidate(element, hasViewportCandidate));
  }

  function rankCandidates(options = {}) {
    const candidates = getCandidates().filter((candidate) => {
      const { element, metadata } = candidate;
      return metadata.visible && metadata.enabled && metadata.editable &&
        (!metadata.hasViewportCandidate || metadata.inViewport) &&
        (!options.skipPasswords || !metadata.isPassword) &&
        (!options.ignoreTiny || (metadata.width >= 120 && metadata.height >= 20));
    });

    const preference = options.preference || "auto";
    candidates.forEach((candidate) => {
      const searchable = [candidate.metadata.type, candidate.metadata.placeholder,
        candidate.metadata.ariaLabel, candidate.metadata.name, candidate.metadata.id,
        candidate.metadata.context].join(" ").toLowerCase();
      const isSearch = candidate.metadata.type === "search" || candidate.metadata.name === "q" ||
        /search|query|find/.test(searchable);
      const isWriting = candidate.metadata.contentEditable || candidate.metadata.type === "textarea" ||
        /chat|message|prompt|comment|write|ask|reply|compose/.test(searchable);
      candidate.adjustedScore = candidate.score +
        (preference === "search" && isSearch ? 220 : 0) +
        (preference === "chat" && isWriting ? 220 : 0);
    });

    candidates.sort((a, b) => b.adjustedScore - a.adjustedScore);
    return candidates;
  }

  function findBestCandidate(options = {}) {
    return rankCandidates(options)[0] || null;
  }

  global.UniversalFocusDetector = { getCandidates, rankCandidates, findBestCandidate };
  if (typeof module !== "undefined" && module.exports) module.exports = { getCandidates, rankCandidates, findBestCandidate };
})(typeof globalThis !== "undefined" ? globalThis : window);
