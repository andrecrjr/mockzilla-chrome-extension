import { BatchInterceptor } from '@mswjs/interceptors';
import { FetchInterceptor } from '@mswjs/interceptors/fetch';
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest';



console.log('Mockzilla RR injected script running (MSW Mode)');

const RR_NS = '__RR__';
const state = {
  rules: [],
};

// ---------------------------------------------------------
// Helper Logic (Ported from original injected.js)
// ---------------------------------------------------------

function normalizeUrl(u) {
  try {
    const s = String(u ?? '');
    try {
      return new URL(s, location.href).href;
    } catch {
      return s;
    }
  } catch {
    return '';
  }
}

function sanitizePattern(p) {
  let s = String(p ?? '');
  s = s.trim();
  const first = s[0];
  const last = s[s.length - 1];
  if (s.length >= 2 && ((first === '`' && last === '`') || (first === '"' && last === '"') || (first === "'" && last === "'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function matchesRule(url, rule) {
  if (rule.globalEnabled === false) return false;
  if (rule.enabled === false) return false;
  
  const target = normalizeUrl(url);
  const rawPattern = sanitizePattern(rule.pattern);
  if (!rawPattern) return false;
  
  const absPattern = normalizeUrl(rawPattern);
  
  if (rule.matchType === 'exact') {
    return target === absPattern;
  }
  if (rule.matchType === 'wildcard') {
    const m1 = matchWildcard(target, absPattern);
    if (m1.ok) return true;
    const m2 = matchWildcard(target, rawPattern);
    return m2.ok;
  }
  return target.includes(rawPattern) || target.includes(absPattern);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wildcardToRegex(p) {
  const s = String(p || '');
  const parts = s.split('*').map(escapeRegex);
  const pattern = parts.join('(.+?)');
  const anchored = s.includes('://') ? '^' + pattern + '$' : '.*' + pattern + '.*';
  return new RegExp(anchored);
}

function matchWildcard(url, pattern) {
  const p = String(pattern || '');
  const re = wildcardToRegex(p);
  const m = re.exec(url);
  if (!m) return { ok: false, captures: [] };
  const caps = m.slice(1);
  return { ok: true, captures: caps };
}

function getCaptureKey(rule, url) {
  if (rule.matchType !== 'wildcard') return null;
  const rawPattern = sanitizePattern(rule.pattern);
  const absPattern = normalizeUrl(rawPattern);
  const mAbs = matchWildcard(url, absPattern);
  const mRaw = mAbs.ok ? mAbs : matchWildcard(url, rawPattern);
  if (!mRaw.ok) return null;
  return mRaw.captures.join('|');
}

function selectVariant(rule, url) {
  const key = getCaptureKey(rule, url);
  if (key === null) return null;
  
  const variants = Array.isArray(rule.variants) ? rule.variants : [];
  const v = variants.find(x => String(x.key) === key);
  if (!v) return null;
  return {
    key: key,
    bodyType: v.bodyType || rule.bodyType,
    statusCode: v.statusCode || rule.statusCode || 200,
    body: v.body ?? ''
  };
}

function getStatusCodeText(statusCode) {
  const statusTexts = {
    200: 'OK', 201: 'Created', 204: 'No Content',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 422: 'Unprocessable Entity',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable'
  };
  return statusTexts[statusCode] || 'OK';
}

function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function notifyRuleHit(hit) {
  window.postMessage({ __rr: true, type: 'RULE_HIT', hit }, '*');
  console.log('Mockzilla Rule HIT:', hit.ruleName || hit.ruleId, hit.url);
}

// ---------------------------------------------------------
// MSW Interceptor Setup
// ---------------------------------------------------------

const interceptor = new BatchInterceptor({
  name: 'mockzilla-interceptor',
  interceptors: [
    new FetchInterceptor(),
    new XMLHttpRequestInterceptor(),
  ],
});

let _interceptorApplied = false;

function applyInterceptor() {
  if (_interceptorApplied) return;
  try {
    interceptor.apply();
    _interceptorApplied = true;
    console.log('Mockzilla: Interceptor applied');
  } catch (e) {
    console.warn('Mockzilla: Failed to apply interceptor', e);
  }
}

function disposeInterceptor() {
  if (!_interceptorApplied) return;
  try {
    interceptor.dispose();
    _interceptorApplied = false;
    console.log('Mockzilla: Interceptor disposed');
  } catch (e) {
    console.warn('Mockzilla: Failed to dispose interceptor', e);
  }
}

interceptor.on('request', async ({ request, controller }) => {
  console.log('Mockzilla Interceptor Request:', request.url);
  try {
    const url = request.url;
    const absUrl = normalizeUrl(url);
    
    // Find matching rule
    const rule = state.rules.find((r) => matchesRule(absUrl, r));
    
    if (rule) {
      const variant = selectVariant(rule, absUrl);
      
      // Logic for wildcard variants matching requirement
      if (rule.matchType === 'wildcard' && rule.wildcardRequireMatch === true) {
        if (!variant) {
          return; // Passthrough
        }
      }
      
      // Determine response details
      const bodyType = variant ? variant.bodyType : rule.bodyType;
      const statusCode = variant ? variant.statusCode : (rule.statusCode || 200);
      const bodyRaw = variant ? variant.body : rule.body;
      
      const body = bodyType === 'json' ? JSON.stringify(safeParseJSON(bodyRaw)) : String(bodyRaw ?? '');
      const statusText = getStatusCodeText(statusCode);
      
      // Notify content script with full data
      notifyRuleHit({
        ruleId: rule.id,
        ruleName: rule.name || 'Untitled Rule',
        rulePattern: rule.pattern,
        ruleMatchType: rule.matchType,
        url: absUrl,
        method: request.method,
        statusCode: statusCode,
        bodyType: bodyType,
        body: body.length > 5000 ? body.substring(0, 5000) + '... (truncated)' : body,
        variantKey: getCaptureKey(rule, absUrl),
        timestamp: Date.now()
      });
      
      const response = new Response(body, {
        status: statusCode,
        statusText: statusText,
        headers: {
          'Content-Type': bodyType === 'json' ? 'application/json' : 'text/plain;charset=UTF-8'
        }
      });
      
      controller.respondWith(response);
    }
  } catch (err) {
    console.error('Mockzilla Interceptor Error:', err);
  }
});

// ---------------------------------------------------------
// Rule Syncing
// ---------------------------------------------------------

function updateRules(newRules) {
  const rules = Array.isArray(newRules) ? 
    newRules.filter(Boolean).map(rule => ({
      ...rule,
      // Ensure defaults are set, similar to original logic
      enabled: rule.enabled !== false,
      globalEnabled: rule.globalEnabled !== false,
      variants: Array.isArray(rule.variants) ? rule.variants : [],
      wildcardRequireMatch: (rule.matchType === 'wildcard' && rule.wildcardRequireMatch !== false)
    })) : [];
  
  state.rules = rules;

  // Lifecycle management
  if (rules.length > 0) {
    applyInterceptor();
  } else {
    // If no rules (or globally disabled which sends empty rules), dispose.
    disposeInterceptor();
  }
}

window.addEventListener('message', (ev) => {
  const msg = ev.data;
  if (!msg || !msg.__rr) return;
  if (msg.type === 'RULES_UPDATE') {
    updateRules(msg.rules);
  }
});

// Expose debug namespace
window[RR_NS] = {
  getRules: () => state.rules.slice(),
};

// Request rules on startup
try {
  window.postMessage({ __rr: true, type: 'REQUEST_RULES' }, '*');
} catch {}
