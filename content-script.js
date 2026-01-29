// Content script: injects the page script and syncs rules from storage

// Helper: Convert wildcard pattern to Regex (e.g., "*://example.com/*")
// (Removed unused wildcardToRegex and ruleMatchesPage)

// Safe helper: consider injected as present to avoid runtime errors
function isInjected() {
  // We cannot reliably read page-world globals from the content script due to
  // isolated worlds. Treat injection as successful after appending the tag.
  return true;
}

let _injectionDone = false;

// Inject the page script
async function injectSequence(initialRules) {
  if (_injectionDone) {
    // Just update rules if already injected
    sendRulesToPage(initialRules);
    return;
  }
  _injectionDone = true;

  try {
    // Avoid duplicate injection across extension reloads or multiple content scripts
    if (document.querySelector('script[data-source="response-replacer"]')) {
      sendRulesToPage(initialRules);
      return;
    }

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.bundle.js');
    script.type = 'module';
    script.dataset.source = 'response-replacer';
    // Ensure synchronous execution order with page scripts
    script.async = false;

    // Remove the tag only after it loads to avoid cancelling execution
    script.addEventListener('load', () => {
      try {
        console.log('Mockzilla: injected.js loaded');
        script.remove();
        // Send rules immediately after load
        sendRulesToPage(initialRules);
      } catch {}
    });

    (document.documentElement || document.head || document.body).appendChild(script);
    
    // After a brief delay, verify it's loaded; if not, ask background to inject in MAIN world.
    setTimeout(async () => {
      if (!isInjected()) {
        try {
          // If pure tag injection failed (CSP?), try background injection
          const resp = await chrome.runtime.sendMessage({ type: 'INJECT_MAIN_WORLD' });
          if (!resp || !resp.ok) {
            console.warn('Mockzilla: background MAIN-world injection failed', resp?.error);
          } else {
            console.log('Mockzilla: background MAIN-world injection succeeded');
            // Assuming background injection works, send rules
            setTimeout(() => sendRulesToPage(initialRules), 50);
          }
        } catch (err) {
          console.warn('Mockzilla: failed to request MAIN-world injection', err);
        }
      }
    }, 50);
  } catch (e) {
    console.warn('Mockzilla: failed to inject', e);
  }
}

// Send initial rules to injected script
async function sendRulesToPage(rules) {
  window.postMessage({ __rr: true, type: 'RULES_UPDATE', rules }, '*');
}

// Load rules from chrome.storage (metadata from sync, body from local)
// Load rules from chrome.storage (metadata from sync, body from local)
async function loadRulesAndInject() {
  if (!window.chrome || !chrome.storage || !chrome.storage.sync) return [];
  
  const [metaItems, bodyItems] = await Promise.all([
    chrome.storage.sync.get(null),
    chrome.storage.local.get(null),
  ]);
  
  const globalEnabled = metaItems?.rr_enabled !== false; // default true when unset
  const rules = [];

  // Parse rules
  for (const key in metaItems) {
    if (key.startsWith('rr_rule_')) {
      const id = key.substring('rr_rule_'.length);
      const value = metaItems[key];
      if (value && typeof value === 'object') {
        const bodyKey = `rr_body_${id}`;
        const varBodyKey = `rr_varbody_${id}`;
        const bodyFromLocal = bodyItems[bodyKey];
        const varBodiesFromLocal = bodyItems[varBodyKey] || {};
        const variantsMeta = Array.isArray(value.variants) ? value.variants : [];
        const variants = variantsMeta.map(v => ({
          key: String(v.key || ''),
          bodyType: v.bodyType || value.bodyType || 'text',
          statusCode: v.statusCode || value.statusCode || 200,
          body: typeof varBodiesFromLocal[String(v.key || '')] === 'string' ? varBodiesFromLocal[String(v.key || '')] : ''
        }));
        
        const rule = {
          id,
          matchType: value.matchType || 'substring',
          pattern: value.pattern || '',
          enabled: value.enabled !== false, // default to true when unset
          bodyType: value.bodyType || 'text',
          group: value.group || '',
          statusCode: value.statusCode || 200,
          statusText: value.statusText || '',
          body: (typeof bodyFromLocal === 'string') ? bodyFromLocal : (value.body || ''),
          globalEnabled: globalEnabled,
          variants: variants,
          wildcardRequireMatch: (value.matchType === 'wildcard' && value.wildcardRequireMatch !== false)
        };
        
        rules.push(rule);
      }
    }
  }

  // Filter Logic:
  // Find which rules match (based on enabled status only now)
  const matchingRules = rules.filter(r => r.enabled);
  
  // Conditional Injection:
  if (!globalEnabled) {
      console.log('Mockzilla: Globally disabled. Skipping/Disabling injection.');
      if (_injectionDone) {
          // Send empty rules/disable signal to dispose interceptor
          sendRulesToPage([]); 
      }
      return; 
  }
  
  // Inject ONLY if there is at least one enabled rule that matches this page.
  // (Since we removed pagePattern, this just means "at least one enabled rule exists")
  if (matchingRules.length > 0) {
      console.log(`Mockzilla: ${matchingRules.length} enabled rules found. Injecting.`);
      await injectSequence(matchingRules); 
      // We already sent rules in injectSequence or it will be sent via load callback.
      // But let's ensure we are synced.
      if (_injectionDone) {
         sendRulesToPage(matchingRules);
      }
  } else {
      console.log('Mockzilla: No enabled rules found. Skipping injection.');
      // Do not inject.
      // But if we previously injected, we should disable/dispose.
      if (_injectionDone) {
          sendRulesToPage([]); 
      }
  }
  
  // Cache rules for UI usage
  _cachedRules = matchingRules;
}

// Listen for changes to rules in storage and notify the page
if (window.chrome && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'sync' || areaName === 'local') {
      await loadRulesAndInject();
    }
  });
}

// Forward rule hits from the page to the background script
const __pendingHits = [];
let __flushScheduled = false;

function safeSendRuleHit(ruleId, url) {
  let ok = false;
  try { ok = !!(chrome && chrome.runtime && chrome.runtime.id); } catch {}
  if (ok) {
    try { 
      chrome.runtime.sendMessage({ type: 'RULE_HIT', ruleId, url }); 
      return; 
    } catch (e) {
      // fall through to queue
    }
  }
  __pendingHits.push({ ruleId, url });
  if (!__flushScheduled) {
    __flushScheduled = true;
    const retry = () => {
      let ready = false;
      try { ready = !!(chrome && chrome.runtime && chrome.runtime.id); } catch {}
      if (ready) {
        const items = __pendingHits.splice(0);
        items.forEach((h) => { 
          try { chrome.runtime.sendMessage({ type: 'RULE_HIT', ruleId: h.ruleId, url: h.url }); } catch {} 
        });
        __flushScheduled = false;
      } else {
        setTimeout(retry, 100);
      }
    };
    setTimeout(retry, 100);
  }
}

window.addEventListener('message', (ev) => {
  const msg = ev.data;
  if (!msg || !msg.__rr) return;
  if (msg.type === 'RULE_HIT') {
    safeSendRuleHit(msg.ruleId, msg.url);
    
    // Update UI
    _hitHistory.push({ ruleId: msg.ruleId, url: msg.url, timestamp: Date.now() });
    
    // "Show once" logic: auto-expand on first hit of the session
    if (!_hasShownInitialOpen) {
      _hasShownInitialOpen = true;
      _isExpanded = true;
    }
    
    renderOverlay();
  }
  if (msg.type === 'REQUEST_RULES') {
    (async () => {
      try {
        await loadRulesAndInject();
      } catch {}
    })();
  }
});

// Initial load
loadRulesAndInject();

// ---------------------------------------------------------------------------
// UI / Overlay Logic
// ---------------------------------------------------------------------------

let _cachedRules = [];
let _hitHistory = [];
let _overlayHost = null;
let _overlayRoot = null;
let _isExpanded = false;
let _hasShownInitialOpen = false;

function getRuleById(id) {
  return _cachedRules.find(r => r.id === id);
}

function setupOverlay() {
  if (_overlayHost) return;

  _overlayHost = document.createElement('div');
  _overlayHost.id = 'mockzilla-overlay-host';
  _overlayHost.style.position = 'fixed';
  _overlayHost.style.zIndex = '2147483647'; // Max z-index
  _overlayHost.style.bottom = '20px';
  _overlayHost.style.right = '20px';
  _overlayHost.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  
  _overlayRoot = _overlayHost.attachShadow({ mode: 'open' });
  
  document.body.appendChild(_overlayHost);
}

function toggleExpand() {
  _isExpanded = !_isExpanded;
  renderOverlay();
}

function clearHistory() {
  _hitHistory = [];
  renderOverlay();
}

function renderOverlay() {
  if (!_overlayHost) setupOverlay();
  
  if (_hitHistory.length === 0) {
    _overlayHost.style.display = 'none';
    return;
  }
  _overlayHost.style.display = 'block';

  // Styles
  const style = `
    <style>
      .container {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
      }
      .pill {
        background: #0f172a;
        color: #fff;
        padding: 8px 12px;
        border-radius: 999px;
        cursor: pointer;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: transform 0.2s;
        border: 1px solid #334155;
      }
      .pill:hover {
        transform: scale(1.02);
        background: #1e293b;
      }
      .pill-badge {
        background: #ef4444;
        color: white;
        border-radius: 999px;
        padding: 2px 6px;
        font-size: 12px;
        min-width: 16px;
        text-align: center;
      }
      .panel {
        background: #0f172a;
        color: #e2e8f0;
        width: 320px;
        max-height: 500px;
        border-radius: 12px;
        border: 1px solid #334155;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .panel-header {
        padding: 12px 16px;
        background: #1e293b;
        border-bottom: 1px solid #334155;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
      }
      .panel-body {
        padding: 0;
        overflow-y: auto;
      }
      .hit-item {
        padding: 12px 16px;
        border-bottom: 1px solid #1e293b;
        font-size: 13px;
      }
      .hit-item:last-child {
        border-bottom: none;
      }
      .hit-url {
        color: #38bdf8;
        word-break: break-all;
        margin-bottom: 4px;
        font-family: monospace;
      }
      .hit-meta {
        color: #94a3b8;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .method-badge {
        background: #334155;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        color: #f1f5f9;
        text-transform: uppercase;
      }
      .status-badge {
        color: #4ade80;
        font-weight: 600;
      }
      .clear-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 12px;
        text-decoration: underline;
      }
      .clear-btn:hover {
        color: #f1f5f9;
      }
    </style>
  `;

  // Content
  const pill = `
    <div class="pill" id="toggle-btn">
      <span>⚡ Mockzilla</span>
      <span class="pill-badge">${_hitHistory.length}</span>
    </div>
  `;

  let panel = '';
  if (_isExpanded) {
    const items = [..._hitHistory].reverse().map(hit => {
      const rule = getRuleById(hit.ruleId);
      const ruleName = rule ? (rule.pattern || 'Unknown Rule') : 'Unknown Rule';
      const statusCode = rule ? (rule.statusCode || 200) : 200;
      return `
        <div class="hit-item">
          <div class="hit-url">${new URL(hit.url).pathname}</div>
           <div class="hit-meta">
            <span class="method-badge">MATCH</span>
            <span>${ruleName}</span>
            <span class="status-badge">${statusCode}</span>
            <span style="margin-left:auto; opacity:0.6;text-align:center;">${new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      `;
    }).join('');

    panel = `
      <div class="panel">
        <div class="panel-header">
          <span>Captured Rules</span>
          <button class="clear-btn" id="clear-btn">Clear</button>
        </div>
        <div class="panel-body">
          ${items.length ? items : '<div style="padding:16px; text-align:center; color:#64748b;">No Rules yet</div>'}
        </div>
      </div>
    `;
  }

  _overlayRoot.innerHTML = `${style}<div class="container">${panel}${pill}</div>`;

  // Event Listeners
  _overlayRoot.getElementById('toggle-btn').addEventListener('click', toggleExpand);
  if (_isExpanded) {
      _overlayRoot.getElementById('clear-btn')?.addEventListener('click', clearHistory);
  }
}
