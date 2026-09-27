(function universalFocusScorer(global) {
  "use strict";

  const POSITIVE_WORDS = [
    "search", "chat", "message", "prompt", "comment", "ask", "question",
    "write", "reply", "compose", "query", "find", "talk", "send"
  ];
  const NEGATIVE_WORDS = [
    "password", "email", "username", "login", "newsletter", "subscribe",
    "coupon", "promo", "zip", "postal", "phone", "address", "search-filter"
  ];

  function text(value) {
    return String(value || "").trim().toLowerCase();
  }

  function scoreCandidate(candidate) {
    const metadata = candidate.metadata || {};
    const haystack = text([
      metadata.type,
      metadata.placeholder,
      metadata.ariaLabel,
      metadata.name,
      metadata.id,
      metadata.role,
      metadata.context
    ].join(" "));

    let score = 0;
    score += metadata.visible ? 40 : -1000;
    score += metadata.enabled ? 25 : -1000;
    score += metadata.editable ? 30 : -1000;
    score += metadata.inViewport ? 25 : (metadata.hasViewportCandidate ? -45 : 0);
    score += metadata.isPassword ? -100 : 0;

    if (metadata.type === "search") score += 45;
    // Google and many search forms use name="q" without a useful placeholder.
    if (text(metadata.name) === "q" || text(metadata.id) === "q") score += 70;
    if (metadata.type === "textarea") score += 38;
    if (metadata.contentEditable) score += 42;
    if (metadata.role === "textbox") score += 28;

    for (const word of POSITIVE_WORDS) {
      if (haystack.includes(word)) score += 18;
    }
    for (const word of NEGATIVE_WORDS) {
      if (haystack.includes(word)) score -= 24;
    }

    const area = Math.max(0, Number(metadata.width) * Number(metadata.height));
    if (area >= 3000) score += 15;
    if (Number(metadata.width) < 120 || Number(metadata.height) < 20) score -= 30;
    if (metadata.isNearTop) score += 6;
    if (metadata.isPrimaryLike) score += 12;
    if (metadata.isInsideForm && haystack.includes("login")) score -= 30;

    return score;
  }

  const api = { scoreCandidate, POSITIVE_WORDS, NEGATIVE_WORDS };
  global.UniversalFocusScorer = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
