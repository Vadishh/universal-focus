const test = require("node:test");
const assert = require("node:assert/strict");
const { scoreCandidate } = require("../content/scorer.js");

const base = {
  visible: true, enabled: true, editable: true, inViewport: true,
  hasViewportCandidate: true, width: 500, height: 50,
  type: "text", role: "", placeholder: "", ariaLabel: "", name: "", id: "",
  context: "", contentEditable: false, isPassword: false,
  isNearTop: false, isPrimaryLike: false
};

function candidate(overrides) {
  return { metadata: { ...base, ...overrides } };
}

test("chat composer outranks an unrelated small input", () => {
  const chat = scoreCandidate(candidate({ type: "textarea", placeholder: "Message ChatGPT" }));
  const coupon = scoreCandidate(candidate({ width: 90, height: 18, name: "coupon" }));
  assert.ok(chat > coupon);
});

test("search input receives a strong search score", () => {
  const search = scoreCandidate(candidate({ type: "search", placeholder: "Search YouTube" }));
  const generic = scoreCandidate(candidate({ type: "text" }));
  assert.ok(search > generic);
});

test("contenteditable prompt is treated as a high-value candidate", () => {
  const editor = scoreCandidate(candidate({ contentEditable: true, role: "textbox", context: "Write a comment" }));
  assert.ok(editor > 100);
});

test("hidden and disabled candidates cannot win", () => {
  const hidden = scoreCandidate(candidate({ visible: false }));
  const disabled = scoreCandidate(candidate({ enabled: false }));
  assert.ok(hidden < -500);
  assert.ok(disabled < -500);
});

test("login and password metadata are penalized", () => {
  const login = scoreCandidate(candidate({ type: "text", name: "username", context: "Login" }));
  const prompt = scoreCandidate(candidate({ type: "textarea", placeholder: "Ask a question" }));
  assert.ok(prompt > login);
});
