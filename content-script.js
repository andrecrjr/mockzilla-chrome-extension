// Content script: injects the page script and syncs rules from storage

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
          name: value.name || '',
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

// ---------------------------------------------------------------------------
// UI / Overlay Logic
// ---------------------------------------------------------------------------

let _cachedRules = [];
let _hitHistory = [];
let _overlayHost = null;
let _overlayRoot = null;
let _isExpanded = false;
let _hasShownInitialOpen = false;

window.addEventListener('message', (ev) => {
  const msg = ev.data;
  if (!msg || !msg.__rr) return;
  if (msg.type === 'RULE_HIT') {
    const hit = msg.hit;
    if (!hit) {
      // Fallback for old injected script format if not rebuilt yet
      const ruleId = msg.ruleId;
      const url = msg.url;
      if (ruleId) {
        safeSendRuleHit(ruleId, url);
        // Minimal UI update for backwards compatibility
        _hitHistory.push({ ruleId, url, ruleName: 'Updated Rule', statusCode: 200, method: '???', timestamp: Date.now(), _expanded: false });
        renderOverlay();
      }
      return;
    }
    safeSendRuleHit(hit.ruleId, hit.url);
    
    // Update UI
    _hitHistory.push({ ...hit, _expanded: false });
    
    // "Show once" logic
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

function setupOverlay() {
  if (_overlayHost) return;

  _overlayHost = document.createElement('div');
  _overlayHost.id = 'mockzilla-overlay-host';
  _overlayHost.style.position = 'fixed';
  _overlayHost.style.zIndex = '2147483647';
  _overlayHost.style.bottom = '20px';
  _overlayHost.style.right = '20px';
  _overlayHost.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';
  
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

function toggleHitDetails(index) {
  if (_hitHistory[index]) {
    _hitHistory[index]._expanded = !_hitHistory[index]._expanded;
    renderOverlay();
  }
}

function renderOverlay() {
  if (!_overlayHost) setupOverlay();
  
  if (_hitHistory.length === 0) {
    _overlayHost.style.display = 'none';
    return;
  }
  _overlayHost.style.display = 'block';

  // Advanced Styles
  const style = `
    <style>
      :host {
        --bg-main: #0f172a;
        --bg-panel: #1e293b;
        --bg-hover: #334155;
        --border: #334155;
        --accent: #8b5cf6;
        --text-main: #f1f5f9;
        --text-dim: #94a3b8;
        --success: #22c55e;
        --warning: #f59e0b;
        --error: #ef4444;
      }
      .container {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 12px;
        perspective: 1000px;
      }
      .pill {
        background: var(--bg-main);
        color: white;
        padding: 10px 16px;
        border-radius: 999px;
        cursor: pointer;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        font-size: 14px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid var(--border);
        user-select: none;
      }
      .pill:hover {
        transform: translateY(-2px);
        background: var(--bg-panel);
        border-color: var(--accent);
      }
      .pill-badge {
        background: var(--accent);
        color: white;
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 11px;
        min-width: 18px;
        text-align: center;
      }
      .panel {
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(12px);
        color: var(--text-main);
        width: 380px;
        max-height: 600px;
        border-radius: 16px;
        border: 1px solid var(--border);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        flex-shrink: 1;
        min-height: 0;
        animation: slideIn 0.3s ease-out;
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .panel-header {
        padding: 14px 18px;
        background: rgba(30, 41, 59, 0.5);
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 700;
        font-size: 15px;
        flex-shrink: 0;
      }
      .panel-body {
        padding: 8px;
        overflow-y: auto;
        overflow-x: hidden;
        display: block;
        flex: 1 1 auto;
        min-height: 0;
        overscroll-behavior: contain;
      }
      /* Custom Scrollbar */
      .panel-body::-webkit-scrollbar {
        width: 6px;
      }
      .panel-body::-webkit-scrollbar-track {
        background: transparent;
      }
      .panel-body::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      }
      .panel-body::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      .hit-card {
        background: var(--bg-panel);
        border: 1px solid var(--border);
        border-radius: 10px;
        overflow: hidden;
        transition: all 0.2s;
        margin-bottom: 8px;
      }
      .hit-card:hover { border-color: #475569; }
      .hit-header {
        padding: 12px;
        cursor: pointer;
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-top: 5px;
        flex-shrink: 0;
      }
      .hit-content { flex: 1; min-width: 0; }
      .hit-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        gap: 8px;
      }
      .hit-rule-name { font-weight: 700; font-size: 13px; truncate; }
      .hit-status { font-family: monospace; font-size: 12px; font-weight: 800; }
      .hit-url-summary { 
        color: var(--text-dim); 
        font-size: 11px; 
        font-family: monospace; 
        word-break: break-all;
        background: rgba(0,0,0,0.2);
        padding: 4px 6px;
        border-radius: 4px;
      }
      .hit-details {
        padding: 0 12px 12px 12px;
        border-top: 1px solid rgba(255,255,255,0.05);
        font-size: 12px;
        background: rgba(0,0,0,0.1);
      }
      .detail-item { margin-top: 10px; }
      .detail-label { color: var(--text-dim); font-size: 10px; text-transform: uppercase; font-weight: 700; margin-bottom: 3px; }
      .detail-value { font-family: monospace; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px; line-height: 1.4; white-space: pre-wrap; word-break: break-all; max-height: 150px; overflow-y: auto; }
      
      .tag {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .tag-method { background: var(--accent); color: white; }
      .tag-match { background: #334155; color: #cbd5e1; }
      
      .footer-actions {
        padding: 10px 18px;
        border-top: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(30, 41, 59, 0.3);
        flex-shrink: 0;
      }
      .clear-btn, .options-link {
        color: var(--text-dim);
        font-size: 12px;
        text-decoration: none;
        cursor: pointer;
        transition: color 0.2s;
        background: none;
        border: none;
        padding: 0;
      }
      .clear-btn:hover, .options-link:hover { color: white; }
    </style>
  `;

  // Content
  const pill = `
    <div class="pill" id="toggle-btn">
      <span>🦖 Mockzilla</span>
      <span class="pill-badge">${_hitHistory.length}</span>
    </div>
  `;

  let panel = '';
  if (_isExpanded) {
    const items = [..._hitHistory].reverse().map((hit, idx) => {
      const actualIdx = _hitHistory.length - 1 - idx;
      const statusColor = hit.statusCode >= 200 && hit.statusCode < 300 ? 'var(--success)' : 
                         hit.statusCode >= 400 ? 'var(--error)' : 'var(--warning)';
      const timeStr = new Date(hit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      return `
        <div class="hit-card">
          <div class="hit-header" data-idx="${actualIdx}">
            <div class="status-dot" style="background: ${statusColor}; box-shadow: 0 0 8px ${statusColor}"></div>
            <div class="hit-content">
              <div class="hit-title-row">
                <div class="hit-rule-name">${escapeHtml(hit.ruleName)}</div>
                <div class="hit-status" style="color: ${statusColor}">${hit.statusCode}</div>
              </div>
              <div class="hit-title-row" style="margin-top: 2px;">
                <div style="display: flex; gap: 4px; align-items: center;">
                  <span class="tag tag-method">${hit.method}</span>
                  <span class="tag tag-match">${hit.ruleMatchType}</span>
                  ${hit.variantKey ? `<span class="tag" style="background: #10b981; color: white;">#${hit.variantKey}</span>` : ''}
                </div>
                <span style="font-size: 10px; color: var(--text-dim);">${timeStr}</span>
              </div>
              <div class="hit-url-summary">${escapeHtml(hit.url)}</div>
            </div>
          </div>
          ${hit._expanded ? `
            <div class="hit-details">
              <div class="detail-item">
                <div class="detail-label">Match Pattern</div>
                <div class="detail-value">${escapeHtml(hit.rulePattern)}</div>
              </div>
              ${hit.variantKey ? `
              <div class="detail-item">
                <div class="detail-label">Variant Key</div>
                <div class="detail-value">${escapeHtml(hit.variantKey)}</div>
              </div>
              ` : ''}
              <div class="detail-item">
                <div class="detail-label">Response Body (${hit.bodyType})</div>
                <div class="detail-value">${escapeHtml(hit.body)}</div>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    panel = `
      <div class="panel">
        <div class="panel-header">
          <span>Captured Requests</span>
          <button class="clear-btn" id="clear-btn">Clear All</button>
        </div>
        <div class="panel-body">
          ${items || '<div style="padding:40px; text-align:center; color:var(--text-dim); font-size:13px;">No requests captured yet</div>'}
        </div>
        <div class="footer-actions">
           <a href="${chrome.runtime.getURL('options.html')}" rel="noreferrer" target="_blank" class="options-link">Open Dashboard</a>
           <div style="display:flex; gap:4px;">
           <a href="https://ac-jr.com" rel="noreferrer" target="_blank" class="options-link">AC-JR</a>
           <a href="https://ko-fi.com/andrecrjr" rel="noreferrer" target="_blank" style="font-size: 14px; color: var(--text-dim); opacity: 0.5; text-decoration:none;">☕🦖</a>
           </div>
        </div>
      </div>
    `;
  }

  _overlayRoot.innerHTML = `${style}<div class="container">${panel}${pill}</div>`;

  // Event Listeners
  _overlayRoot.getElementById('toggle-btn').addEventListener('click', toggleExpand);
  if (_isExpanded) {
    _overlayRoot.getElementById('clear-btn')?.addEventListener('click', clearHistory);
    _overlayRoot.querySelectorAll('.hit-header').forEach(el => {
      el.addEventListener('click', () => {
        toggleHitDetails(parseInt(el.dataset.idx));
      });
    });
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
