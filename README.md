# Universal Focus

Universal Focus is a free, local-only Chrome extension that uses a keyboard shortcut to focus the most relevant search box or writing/chat editor on the current webpage.

It is designed for modern web apps—not just traditional search bars—including ChatGPT-style contenteditable composers.

## Features

- Manifest V3 Chrome extension
- Default shortcut: `Ctrl+Shift+Space`
- Focuses search inputs, textareas, contenteditable editors, and ARIA textboxes
- Transparent heuristic ranking based on labels, placeholders, names, context, dimensions, and position
- Chat and writing fields are supported as first-class candidates
- Repeated shortcut presses cycle through ranked fields
- Open Shadow DOM traversal
- Google-specific fallback for `[name="q"]` search fields
- Optional focus indicator
- Options page for indicator, filtering, and per-site preferences
- No backend, analytics, external API, or AI dependency

## Install from GitHub

GitHub distribution is free and does not require Chrome Web Store publishing.

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository folder containing `manifest.json`.
6. Open `chrome://extensions/shortcuts` and assign the shortcut.

After source changes, click **Reload** on the extension card and reload the webpage being tested.

## Configure it

Open the extension's **Details** page and choose **Extension options**.

Available settings:

- Focus indicator color and duration
- Ignore tiny fields
- Always ignore password fields
- Per-domain preference: `auto`, `search`, or `chat`

Examples:

```text
google.com          → search
youtube.com         → search
chatgpt.com         → chat
gemini.google.com   → chat
```

## Test it

If Node.js is installed:

```bash
npm test
```

The tests cover search scoring, chat textareas, contenteditable editors, hidden and disabled fields, login/unrelated inputs, and competing candidates.

For manual testing, open [tests/manual-test.html](tests/manual-test.html) in Chrome. It includes search, chat, contenteditable, hidden, disabled, readonly, password, tiny, login-like, and dynamically inserted fields.

## Project structure

```text
├── manifest.json          # Manifest V3 configuration
├── background.js          # Keyboard command service worker
├── content/
│   ├── content.js         # Focus and cycling behavior
│   ├── detector.js        # DOM discovery and filtering
│   ├── scorer.js          # Transparent candidate scoring
│   └── indicator.css      # Focus outline
├── options.html/js/css    # Local settings page
├── tests/                 # Automated and manual tests
├── PRIVACY.md             # Data handling statement
└── README.md              # Installation and development guide
```

## Permissions

- `activeTab`: lets the shortcut target the currently active webpage.
- `storage`: saves only local extension settings and site preferences.

The extension does not store or transmit webpage text, typed messages, search queries, browsing history, passwords, or form data.

## Limitations

- Chrome-restricted pages such as `chrome://newtab/`, `chrome://extensions/`, and the Chrome Web Store cannot be inspected by normal content scripts.
- Cross-origin iframe fields are not inspected from the top page.
- Closed Shadow DOM cannot be traversed.
- Websites can intercept focus or replace their editor after focus.
- Exact site layouts can change; report failures with the issue template.

## License

MIT. See [LICENSE](LICENSE).
