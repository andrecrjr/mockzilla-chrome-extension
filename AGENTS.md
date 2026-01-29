# Project Context & Agent Guide

> **Note to Agents:** This document is your primary source of truth for understanding the architectural decisions, discovery patterns, and functional core of this project. Use this to orient yourself before making changes.

## 1. Project Identity

**Project Name:** Mockzilla
**Type:** Chrome Extension (Manifest V3)
**Core Purpose:** Client-side request interception and mocking.
**Key Mechanism:** Uses [`@mswjs/interceptors`](https://github.com/mswjs/interceptors) to reliably patch global `fetch` and `XMLHttpRequest` in the browser's "Main World" (page context).

## Coding Standards & Conventions

- **Modules:** The options page uses native ES6 modules (`<script type="module">`). When analyzing the options page, expect a graph of small, focused files (e.g., `storage.js`, `ui.js`, `utils.js`) imported by a main entry point.
- **Async/Await:** Preferred over raw promises/callbacks for storage and messaging.
- **Validation:** JSON bodies are strictly validated before saving. Search for `JSON.parse` wrapped in try/catch blocks within the UI logic.
- **Compatibility:** Avoid update the main data structure, must be careful with legacy data, if needs to update, **ALWAYS** must be backward compatible.

## 2. Architectural Discovery Strategy

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

## 3. Core Functional Patterns

### Data Flow & Storage
The project splits data storage to optimize for size and sync limits. When searching for data handling logic, look for these storage keys:
- **Rule Metadata:** Stored in `chrome.storage.sync` (search for `chrome.storage.sync.get` or `.set`). This allows meaningful data (patterns, names) to roam across devices.
- **Rule Bodies:** Stored in `chrome.storage.local` (search for `chrome.storage.local`). Large mock bodies are kept here to avoid the tiny quotas of Sync storage.
- **Ephemeral State:** Stored in `chrome.storage.session`. Used for hit counters that should reset when the browser closes.

### Interception Logic
The interception logic follows this sequence:
1.  **Backup:** Original `window.fetch` and `XMLHttpRequest` are saved.
2.  **Patch:** New functions are assigned to these globals.
3.  **Check:** Incoming requests are normalized (absolute URLs) and checked against active rules.
4.  **Mock vs. Pass:**
    - If **Match**: A `new Response()` is constructed and returned immediately.
    - If **No Match**: The original backed-up function is called.

### Message Passing
Communication crosses three boundaries:
`Background` <-> `Content Script` <-> `Injected Script (Main World)`
- **Search Logic:** Look for `chrome.runtime.sendMessage`, `chrome.runtime.onMessage`, and `window.postMessage` (for crossing the Isolated/Main world boundary).

