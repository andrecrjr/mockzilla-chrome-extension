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
