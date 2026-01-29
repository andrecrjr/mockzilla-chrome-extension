# Coding Standards & Conventions

- **Modules:** The options page uses native ES6 modules (`<script type="module">`). When analyzing the options page, expect a graph of small, focused files (e.g., `storage.js`, `ui.js`, `utils.js`) imported by a main entry point.
- **Async/Await:** Preferred over raw promises/callbacks for storage and messaging.
- **Validation:** JSON bodies are strictly validated before saving. Search for `JSON.parse` wrapped in try/catch blocks within the UI logic.
- **Compatibility:** Avoid update the main data structure, must be careful with legacy data, if needs to update, **ALWAYS** must be backward compatible.

## Options Page Specific Standards

- **Modular Architecture:** The options page follows a modular architecture pattern with clear separation of concerns:
  - `main.js`: Entry point and initialization only - avoid placing business logic here
  - `ruleManager.js`: Core business logic for rule/group operations
  - `storage.js`: Chrome storage operations only - no UI logic
  - `state.js`: Application state management - no DOM manipulation
  - `ui.js`: DOM rendering and UI interactions only - no business logic
  - `utils.js`: Pure utility functions - no side effects
- **Function Naming:** Use descriptive function names that clearly indicate their purpose
- **Error Handling:** Always implement try-catch blocks for storage operations and JSON parsing
- **Performance:** Use debounced functions for frequent operations (e.g., input changes) to prevent excessive storage writes
- **Accessibility:** Ensure all interactive elements are keyboard accessible and have proper ARIA attributes
- **State Management:** Use the centralized state management system rather than global variables
- **Storage Efficiency:** Follow the split-storage approach (metadata in sync, bodies in local) to optimize for Chrome storage quotas