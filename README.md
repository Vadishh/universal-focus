# Universal Focus

Universal Focus is a free, fast, local-only Chrome extension that uses intuitive keyboard shortcuts to focus the most relevant search box or writing/chat editor on any webpage.

Built for modern web applications—not just traditional query inputs—it natively understands contenteditable composers (ChatGPT, Claude, Notion), rich text areas, and dynamic single-page app (SPA) inputs.

---

## Features

- **Manifest V3** Chrome extension with strict local-only execution (zero tracking, zero analytics, zero external API calls).
- **Core Keyboard Shortcuts:**
  - `Ctrl+Shift+Space` (or `Cmd+Shift+Space` on macOS): Focus the smartest field on the page. Pressing repeatedly cycles through ranked candidates.
  - `/` (Slash): Instantly jump to the primary search input on any page (with smart detection so typing inside fields remains undisturbed).
  - `Esc` (Escape): Cleanly unfocus any input and return keyboard control to the page for scrolling and site navigation.
- **Auto-Focus on Page Load:** Automatically target and focus your desired field on specified domains (e.g. `chatgpt.com`, `youtube.com`, `google.com`) as soon as you arrive.
- **Custom CSS Selectors:** Specify exact CSS selectors per site (e.g. `notion.so` → `#search-input`) to override heuristic ranking on bespoke web apps.
- **Daily Focus Stats Badge:** Visual counter directly on the extension icon badge showing how many times you've used Universal Focus today, resetting automatically at midnight.
- **Synthesized Audio Feedback:** Multi-layered, punchy chime (lead triangle chime, octave shimmer, and mechanical click transient) routed through a Web Audio Dynamics Compressor. Driven by a dedicated Manifest V3 offscreen audio engine (`offscreen.html`) so sound is 100% reliable across all tabs without being blocked by Chrome's autoplay policies.
- **Interactive Onboarding Experience:** Interactive welcome page on install (`onboarding.html`) with an interactive keycap sandbox to test shortcuts live, sound previews, and platform auto-detection.
- **Heuristic Intelligence Engine:**
  - Evaluates inputs by semantic type, placeholder, ARIA labels, visibility, element dimensions, viewport position, and context.
  - Penalizes password inputs, hidden fields, promo boxes, and login credentials by default.
  - Automatically highlights existing search text for instant replacement.
  - Traverses open Shadow DOM boundaries and handles Google-specific fallback selectors.
- **Aesthetic & Control Center:**
  - Signature electric lime (`#b7ff3c`) on deep obsidian (`#050706`) reticle aesthetic.
  - Live interactive settings page with Aurora Borealis wave background, magnetic dot grid, cursor spotlight, lagged cursor ring, and 3D card tilt on hover.
  - Visual glow ring with customizable color and duration.
  - Quick popup controls to target **Best Field**, **Search**, or **Chat** directly.

---

## Install from GitHub

GitHub distribution is free and does not require Chrome Web Store publishing.

1. Clone or download this repository.
2. Open Chrome or Brave and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the folder containing `manifest.json`.
6. *(Optional)* Visit `chrome://extensions/shortcuts` to customize your keyboard shortcut.

After making local source code changes, click the **↻ reload** icon on the extension card in `chrome://extensions`.

---

## Configuration & Settings

Right-click the extension icon and select **Options** (or click **Settings** from the popup) to open the control center:

### 1. Appearance (`01 / Appearance`)
- **Glow color:** Live color picker that syncs with all extension indicators.
- **Signal duration:** Slider from 100 ms to 5000 ms controlling how long the visual glow lingers.
- **Focus sound:** Enable/disable audio feedback, adjust volume (5% – 100%), and audition the sound with the **"▶ Test sound"** button.

### 2. Behavior (`02 / Behavior`)
- **Ignore tiny fields:** Skips compact inputs like coupon codes and ZIP inputs.
- **Protect password fields:** Never targets password inputs by default.
- **Slash to focus (`/`):** Toggle the quick search jump shortcut.
- **Escape to blur (`Esc`):** Toggle the quick unfocus shortcut.
- **Debug intelligence:** Displays an in-page floating inspector detailing detected fields and their raw heuristic scores.

### 3. Personalization (`03 / Personalization`)
Assign per-domain target preferences:
- `auto`: Balanced heuristic scoring.
- `search`: Prioritize search bars and query inputs.
- `chat`: Prioritize chat composers and rich text editors.

Examples:
```text
google.com          → search
youtube.com         → search
chatgpt.com         → chat
claude.ai           → chat
