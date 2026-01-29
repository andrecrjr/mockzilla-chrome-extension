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

function selectVariant(rule, url) {
  if (rule.matchType !== 'wildcard') return null;
  const rawPattern = sanitizePattern(rule.pattern);
  const absPattern = normalizeUrl(rawPattern);
  const mAbs = matchWildcard(url, absPattern);
  const mRaw = mAbs.ok ? mAbs : matchWildcard(url, rawPattern);
  const m = mRaw;
  if (!m.ok) return null;
  const key = m.captures.join('|');
  const variants = Array.isArray(rule.variants) ? rule.variants : [];
  const v = variants.find(x => String(x.key) === key);
  if (!v) return null;
  return {
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

function notifyRuleHit(ruleId, url) {
  window.postMessage({ __rr: true, type: 'RULE_HIT', ruleId, url }, '*');
  console.log('Mockzilla Rule HIT:', ruleId, url);
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

interceptor.apply();

interceptor.on('request', async ({ request, controller }) => {
  try {
    const url = request.url;
    const absUrl = normalizeUrl(url);
    
    // Find matching rule
    const rule = state.rules.find((r) => matchesRule(absUrl, r));
    
    if (rule) {
      // Logic for wildcard variants matching requirement
      if (rule.matchType === 'wildcard' && rule.wildcardRequireMatch === true) {
        const v = selectVariant(rule, absUrl);
        if (!v) {
          return; // Passthrough
        }
      }
      
      notifyRuleHit(rule.id, absUrl);
      
      // Determine response details
      const variant = selectVariant(rule, absUrl);
      const bodyType = variant ? variant.bodyType : rule.bodyType;
      const statusCode = variant ? variant.statusCode : (rule.statusCode || 200);
      const bodyRaw = variant ? variant.body : rule.body;
      
      const body = bodyType === 'json' ? JSON.stringify(safeParseJSON(bodyRaw)) : String(bodyRaw ?? '');
      const statusText = getStatusCodeText(statusCode);
      
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
  state.rules = Array.isArray(newRules) ? 
    newRules.filter(Boolean).map(rule => ({
      ...rule,
      // Ensure defaults are set, similar to original logic
      enabled: rule.enabled !== false,
      globalEnabled: rule.globalEnabled !== false,
      variants: Array.isArray(rule.variants) ? rule.variants : [],
      wildcardRequireMatch: (rule.matchType === 'wildcard' && rule.wildcardRequireMatch !== false)
    })) : [];
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
