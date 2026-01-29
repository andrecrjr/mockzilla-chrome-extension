# Architectural Discovery Strategy

Instead of relying on a static file list, use the following logic to discover the relevant code components. This project follows standard Chrome Extension (MV3) architecture.

### 🔍 How to Find: Extension Configuration
- **Target:** The root configuration file.
- **Search Logic:** Look for `manifest.json`.
- **Why:** This file defines the entry points (`background`, `content_scripts`, `action`, `options_ui`) and permissions (`permissions`, `host_permissions`).

### 🔍 How to Find: Background Logic
- **Target:** The persistent (or event-driven) service worker.
- **Search Logic:** Check `manifest.json` for the `background.service_worker` field.
- **Responsibility:** Handles state that must exist outside of any specific tab (e.g., global badge state, installation events) and coordinates data that isn't page-specific. In this project, it specifically manages **hit counters** in `chrome.storage.session`.

### 🔍 How to Find: Content Injection (The Bridge)
- **Target:** Scripts injected into the page to facilitate communication.
- **Search Logic:** Check `manifest.json` for `content_scripts`.
- **Responsibility:** These scripts run in the **Isolated World**. They cannot touch the page's global variables (like `window.fetch`), but they CAN communicate with the extensions background page. Their primary job is to inject the *actual* intercepter code into the Main World.

### 🔍 How to Find: The Interceptor (Monkeypatching)
- **Target:** The code that actually overwrites `fetch` and `XHR`.
- **Search Logic:**
    1.  Look for usage of `scripting.executeScript` or `document.createElement('script')` in the *Content Scripts* or *Background*.
    2.  Look for a file that accesses `window.fetch` or `XMLHttpRequest.prototype`.
- **Responsibility:** This code runs in the **Main World** (the same context as the user's web page). It intercepts calls, checks them against rules, and mocks the response if needed.

### 🔍 How to Find: User Interface (UI)
- **Target:** The visual editors for rules (Popup/Options).
- **Search Logic:** Check `manifest.json` for `action.default_popup` (small UI) or `options_ui` (full page settings).
- **Styling:** The project uses functional CSS (Tailwind). Look for large JS files that might contain the CSS engine or standard Tailwind classes in HTML.

#### 🔍 How to Find: Options Page Specifics
- **Target:** The comprehensive rule management interface.
- **Search Logic:** Look for the `src/optionsPage/` directory which contains modular ES6 JavaScript files.
- **Structure:** The options page follows a modular architecture with separate files for:
  - `main.js`: Entry point and event listener initialization
  - `ruleManager.js`: Business logic for rule/group operations
  - `storage.js`: Chrome storage abstraction layer
  - `state.js`: Application state management
  - `ui.js`: DOM rendering and UI interactions
  - `utils.js`: Utility functions
  - `changelog.js` & `changelogUI.js`: Version information system
- **Responsibility:** Provides a complete interface for creating, editing, organizing, and managing request interception rules. Handles both rule metadata and body content with a split-storage approach to optimize for Chrome storage quotas.
