# Auto Form Filler

A Chrome extension (Manifest V3) that scans web forms, generates realistic demo data, and fills fields automatically. Built for developers and QA who need to quickly test signup flows, branch forms, and other multi-field pages without typing everything manually.

---

## What is this project?

**Auto Form Filler** runs inside your browser as an extension. You open any page with a form, click the extension icon, scan the page, preview generated values, and fill the form in one click. You can also save form layouts as reusable **templates** and fill them again later.

It supports two data generation modes:

| Mode | Description |
|------|-------------|
| **Faker** | Fast, offline random data (names, emails, phones, etc.) via [@faker-js/faker](https://github.com/faker-js/faker) |
| **AI** | Context-aware data via [OpenAI](https://platform.openai.com/docs/overview) — understands form purpose (e.g. "Create New Branch") and generates matching values |

Select and dropdown fields always pick from **real options on the page**, not invented values.

---

## Features

- **Scan Page** — Detects `input`, `textarea`, `select`, and custom UI dropdowns (Material UI, Ant Design)
- **Smart field detection** — Infers field types from labels, names, placeholders (email, phone, state, date, etc.)
- **Preview before fill** — See generated values in a table; regenerate until satisfied
- **Fill Form** — Sets values and dispatches events so React/Vue/Angular forms react correctly
- **Templates** — Save, pin, search, and reuse form configurations in `chrome.storage.local`
- **Custom template builder** — Manually define fields with CSS selectors and types
- **Faker / AI toggle** — Switch generation strategy per session
- **OpenAI API key** — In AI mode, paste your key in the popup; it is saved locally (never compiled into the bundle)
- **Minimize popup** — Collapse the extension UI to a title bar

---

## Project structure

```
form-filler/
├── manifest.json           # MV3 extension config
├── popup/                  # Extension popup UI
│   ├── index.html
│   ├── popup.js            # Tab logic, scan/fill orchestration
│   └── popup.css
├── content/                # Runs on web pages
│   └── content.js          # Field scan, form fill, page context
├── lib/                    # Shared modules (bundled into popup + content)
│   ├── field-scanner.js    # DOM field extraction
│   ├── field-types.js      # Type detection heuristics
│   ├── demo-generator.js   # Faker-based data
│   ├── ai-generator.js     # OpenAI API integration
│   ├── select-utils.js     # Native + custom dropdown handling
│   ├── template-store.js   # Template CRUD (chrome.storage)
│   ├── settings-store.js   # User preferences
│   └── config.js           # OpenAI API URL/model
├── scripts/build.js        # esbuild bundler
├── icons/                  # Extension icons
└── test-form.html          # Local test page
```

---

## How it works

### Architecture

```
┌─────────────┐     messages      ┌──────────────────┐
│  Popup UI   │ ◄──────────────► │  Content Script  │
│  (popup.js) │                   │  (content.js)    │
└──────┬──────┘                   └────────┬─────────┘
       │                                   │
       │ chrome.storage.local              │ DOM read/write
       ▼                                   ▼
┌─────────────┐                   ┌──────────────────┐
│  Templates  │                   │   Web Page Form  │
│  Settings   │                   │   (any site)     │
└─────────────┘                   └──────────────────┘
       │
       │ fetch with user API key (AI mode only)
       ▼
┌─────────────┐
│  OpenAI API │
│  (gpt-4o)   │
└─────────────┘
```

### Core flow

1. **Scan** — Content script walks the DOM, finds form fields, builds stable CSS selectors, detects types, and collects select options.
2. **Generate** — Popup calls Faker, or OpenAI Chat Completions with the key saved in the popup, plus field metadata and page context (title, URL, form heading).
3. **Resolve selects** — For dropdowns, the content script opens the list and picks a real option (random or AI-suggested).
4. **Fill** — Content script sets values using native property descriptors and fires `input`/`change` events for framework compatibility.
5. **Save template** — Field selectors and types persist in `chrome.storage.local` for reuse.

### Field detection highlights

- Native `<select>` elements
- Material UI: `div.MuiSelect-select[role="combobox"]` (ignores hidden `MuiSelect-nativeInput`)
- Ant Design: `.ant-select-selector`
- Heuristic types: email, phone, name, address, city, zip, date, password, etc.

---

## Getting started

### Prerequisites

- Node.js 18+
- Google Chrome (or any Chromium browser)

### Install

```bash
git clone <repo-url>
cd form-filler
npm install
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `form-filler` folder

### AI mode setup (optional)

AI generation uses the [OpenAI Chat Completions API](https://platform.openai.com/docs/api-reference/chat). You provide the key in the extension — it is **not** read from `.env` or baked into `popup.bundle.js`.

1. Create a key at [OpenAI API keys](https://platform.openai.com/api-keys) (account and [billing](https://platform.openai.com/settings/organization/billing) required).
2. Click the extension icon, select **AI** on the Scan tab, paste the key (`sk-...`), and click **Save**.
3. The key is stored in `chrome.storage.local` on this device only. Clearing it in the field and saving removes it.

Reload the extension after a rebuild (`chrome://extensions` → Reload). Default model is `gpt-4o`. To override at build time, copy `.env.example` to `.env` and set `AIML_MODEL` (for example `gpt-4o-mini`), then run `npm run build`.

### Development

```bash
npm run watch   # Rebuild on file changes
```

---

## Usage

1. Open a page with a form (or `test-form.html`)
2. Click the extension icon
3. **Scan tab:**
   - Choose **Faker** (offline) or **AI** (OpenAI)
   - If you chose **AI**, paste your OpenAI API key and click **Save** (see [AI mode setup](#ai-mode-setup-optional))
   - Click **Scan Page**
   - Review the preview table
   - Click **Regenerate** for new values
   - Click **Fill Form**
   - Optionally save as a template
4. **Templates tab:** Pin, search, and one-click fill saved templates
5. **Create tab:** Build custom templates with manual field definitions

---

## Core concepts

### Manifest V3 extension model

- **Popup** — Small UI attached to the toolbar icon
- **Content script** — JavaScript injected into web pages to read/write the DOM
- **Permissions** — `activeTab`, `scripting`, `storage`, and `host_permissions` for `https://api.openai.com/*`
- **Message passing** — Popup and content script communicate via `chrome.tabs.sendMessage`

### Why bundle with esbuild?

Extensions cannot load npm packages from CDNs due to Content Security Policy. Faker and shared `lib/` modules are bundled into `popup.bundle.js` and `content.bundle.js` at build time.

### Why native value setters?

React and other frameworks override `input.value`. Setting values through the prototype's native setter plus dispatching `input` and `change` events ensures the UI updates.

### Hybrid select strategy

| Field | Strategy |
|-------|----------|
| Text inputs | Faker or AI generates value |
| Native `<select>` | Pick from scanned `<option>` list |
| MUI/custom dropdown | Click trigger → open listbox → pick real `[role="option"]` |

AI suggests contextual values; the content script ensures dropdown selections match what the page actually offers.

### Template storage

Templates are stored locally in the browser:

```js
{
  id, name, urlPattern,
  fields: [{ selector, label, type, htmlType, fixedValue }],
  pinned, usageCount, lastUsedAt, createdAt
}
```

---

## Things you can learn from this project

1. **Chrome Extension MV3** — Popup, content scripts, permissions, and `chrome.storage`
2. **DOM introspection** — Building CSS selectors, reading labels, detecting field semantics
3. **Framework-aware form filling** — Native setters and synthetic events for React/Vue forms
4. **Custom component handling** — Material UI selects vs native `<select>` elements
5. **Extension bundling** — esbuild, ES modules, and optional build-time model config
6. **LLM integration in extensions** — User-supplied OpenAI keys, prompt design, JSON parsing, page context
7. **Local-first data** — Templates, settings, and the API key in `chrome.storage.local` without a backend
8. **Progressive enhancement** — Faker works offline; AI runs only after you save an OpenAI key

---

## Browser support

| Browser | Support |
|---------|---------|
| Chrome | Full |
| Edge, Brave, Opera | Full (Chromium-based) |
| Firefox | Partial (would need WebExtension polyfill tweaks) |
| Safari | Requires separate packaging |

---

## License

Private project — use and modify as needed.
