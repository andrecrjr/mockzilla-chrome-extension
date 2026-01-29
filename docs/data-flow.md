# Core Functional Patterns

### Data Flow & Storage
The project splits data storage to optimize for size and sync limits. When searching for data handling logic, look for these storage keys:
- **Rule Metadata:** Stored in `chrome.storage.sync` (search for `chrome.storage.sync.get` or `.set`). This allows meaningful data (patterns, names) to roam across devices.
- **Rule Bodies:** Stored in `chrome.storage.local` (search for `chrome.storage.local`). Large mock bodies are kept here to avoid the tiny quotas of Sync storage.
- **Ephemeral State:** Stored in `chrome.storage.session`. Used for hit counters that should reset when the browser closes.

### Options Page Data Flow
The options page implements a sophisticated data management system:
- **Initialization Flow:** On page load, all rules and groups are retrieved from storage and rendered in the UI
- **Real-time Updates:** Changes to rules/groups are persisted to storage with debounced operations to prevent excessive writes
- **Split Storage Management:** The UI seamlessly handles the separation between metadata (sync) and body content (local) storage
- **Selection State:** The UI maintains selection state to provide context-aware editing experiences
- **Preference Persistence:** UI preferences (theme, density, sort order) are stored in localStorage for persistence across sessions

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

### Options Page Communication
The options page communicates with other extension components through:
- **Storage Layer:** Reads and writes to `chrome.storage.sync` and `chrome.storage.local` for persistent data
- **Global State:** Interacts with background script for extension-wide state (enabled/disabled status)
- **Hit Counters:** Accesses `chrome.storage.session` to display request hit statistics
