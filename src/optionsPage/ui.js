// UI rendering module for options page - handles all DOM rendering functions

import { escapeHtml, flashStatus, isValidJSON } from './utils.js';
import { selectRule, selectGroup, refresh, duplicateRule, autoSyncRule, manualSyncRule } from './ruleManager.js';
import { setRuleMeta, setRuleBody, deleteRule, deleteGroup, setGroup, getRules, setRuleVariantsMeta, setRuleVariantBody, deleteRuleVariant } from './storage.js';
import { groupExpandedState, getSelectedId, getSelectedType, getGroupExpanded, setGroupExpanded, getSearchQuery, getSortOrder, getFilterStatus, getShowUngrouped, getDensity, clearSelection, getServerUrl, getShowServerSyncBanner, setShowServerSyncBanner } from './state.js';

function renderRulesList(rules, groups) {
  const root = document.getElementById('rulesList');
  root.innerHTML = '';

  if (groups.length === 0 && rules.length === 0) {
    root.innerHTML = '<div class="text-center text-gray-500 p-4 text-sm">No groups or rules defined</div>';
    return;
  }

  // Apply search, filter, sort
  let filtered = [...rules];
  const q = getSearchQuery().toLowerCase();
  if (q) {
    filtered = filtered.filter(r => (r.name || '').toLowerCase().includes(q) || (r.pattern || '').toLowerCase().includes(q));
  }
  const status = getFilterStatus();
  if (status === 'enabled') filtered = filtered.filter(r => r.enabled);
  if (status === 'disabled') filtered = filtered.filter(r => !r.enabled);
  const sort = getSortOrder();
  if (sort === 'az') filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (sort === 'enabled') filtered.sort((a, b) => Number(b.enabled) - Number(a.enabled));

  // Group rules by their group ID (after filtering)
  const rulesByGroup = {};
  filtered.forEach(rule => {
    const groupId = rule.group || 'ungrouped';
    if (!rulesByGroup[groupId]) rulesByGroup[groupId] = [];
    rulesByGroup[groupId].push(rule);
  });

  // Render groups first
  groups.forEach(group => {
    // Determine if this group should be expanded
    const isExpanded = getGroupExpanded(group.id); // Default to true if not set
    
    const groupItem = document.createElement('div');
    const densityPad = getDensity() === 'compact' ? 'p-1' : 'p-2';
    groupItem.className = `group-item ${densityPad} rounded cursor-pointer flex items-center justify-between ${getSelectedType() === 'group' && getSelectedId() === group.id ? 'bg-purple-900 border border-blue-200' : 'hover:bg-gray-800'}`;
    groupItem.dataset.groupId = group.id;

    // Get rules in this group to show count
    const groupRules = rulesByGroup[group.id] || [];
    
    groupItem.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="font-medium text-sm truncate flex items-center">
          <svg class="w-4 h-4 mr-1 expand-icon ${isExpanded ? '' : 'rotate-180'}" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
          <svg class="w-4 h-4 mr-1 group-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          ${escapeHtml(group.name)}
          <span class="ml-2 badge badge-gray">${groupRules.length} rules</span>
        </div>
        <div class="text-xs text-gray-500 truncate">${escapeHtml(group.description)}</div>
      </div>
      <div class="flex items-center gap-2">
        <button class="delete-group-btn text-red-500 hover:text-red-700" title="Delete group">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    `;

    // Add click handler for expanding/collapsing
    groupItem.addEventListener('click', (e) => {
      // Check if they clicked on the delete button
      if (!e.target.closest('.delete-group-btn')) {
        // Toggle expansion state
        setGroupExpanded(group.id, !isExpanded);
        renderRulesList(window.currentRules, window.currentGroups);
        selectGroup(group.id); // Select the group when clicked
      }
    });

    const deleteBtn = groupItem.querySelector('.delete-group-btn');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete group "${group.name}" and all its rules?`)) {
        await deleteGroup(group.id);
        setGroupExpanded(group.id, undefined); // Remove expansion state
        await refresh();
        flashStatus('Group deleted', 'success');
      }
    });

    root.appendChild(groupItem);

    // Render rules within this group if expanded
    if (isExpanded) {
      const groupRules = rulesByGroup[group.id] || [];
      groupRules.forEach(rule => {
        const ruleItem = document.createElement('div');
        const densityPad = getDensity() === 'compact' ? 'p-1' : 'p-2';
        ruleItem.className = `rule-item ${densityPad} rounded cursor-pointer flex items-center justify-between ml-4 ${getSelectedType() === 'rule' && getSelectedId() === rule.id ? 'bg-purple-900 border border-blue-200' : 'hover:bg-gray-800'}`;
        ruleItem.dataset.ruleId = rule.id;

        ruleItem.innerHTML = `
          <div class="flex-1 min-w-0 ml-4">
            <div class="font-medium text-sm truncate">${escapeHtml(rule.name || 'Untitled rule')}</div>
            <div class="text-xs text-gray-500 truncate">${escapeHtml(rule.pattern)}</div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge ${rule.enabled ? 'badge-green' : 'badge-gray'}">${rule.enabled ? 'ON' : 'OFF'}</span>
            <button class="delete-btn text-red-500 hover:text-red-700" title="Delete rule">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        `;

        ruleItem.addEventListener('click', () => {
          selectRule(rule.id);
        });

        const deleteBtn = ruleItem.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Delete rule "${rule.name || 'Untitled rule'}"?`)) {
            await deleteRule(rule.id);
            await refresh();
            // If deleted rule was selected, clear selection
            if (getSelectedType() === 'rule' && getSelectedId() === rule.id) {
              clearSelection();
              renderRuleDetails(null);
            }
            flashStatus('Rule deleted', 'success');
          }
        });

        root.appendChild(ruleItem);
      });
    }
  });

  // Render ungrouped rules if any exist
  const showUngrouped = getShowUngrouped();
  const ungroupedRules = rulesByGroup.ungrouped || [];
  if (showUngrouped && ungroupedRules.length > 0) {
    // Add toggle for ungrouped rules
    const ungroupedExpanded = getGroupExpanded('ungrouped');
    const ungroupedHeader = document.createElement('div');
    ungroupedHeader.className = 'p-2 font-medium text-gray-700 text-xs uppercase tracking-wider flex items-center cursor-pointer';
    ungroupedHeader.innerHTML = `
      <svg class="w-4 h-4 mr-1 expand-icon ${ungroupedExpanded ? '' : 'rotate-180'}" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
      Ungrouped Rules <span class="ml-1 badge badge-gray">${ungroupedRules.length}</span>
    `;
    
    ungroupedHeader.addEventListener('click', () => {
      setGroupExpanded('ungrouped', !ungroupedExpanded);
      renderRulesList(window.currentRules, window.currentGroups);
    });
    
    root.appendChild(ungroupedHeader);

    // Render ungrouped rules if expanded
    if (ungroupedExpanded) {
      ungroupedRules.forEach(rule => {
        const ruleItem = document.createElement('div');
        const densityPad = getDensity() === 'compact' ? 'p-1' : 'p-2';
        ruleItem.className = `rule-item ${densityPad} rounded cursor-pointer flex items-center justify-between ${getSelectedType() === 'rule' && getSelectedId() === rule.id ? 'bg-purple-900 border border-blue-200' : 'hover:bg-gray-800'}`;
        ruleItem.dataset.ruleId = rule.id;

        ruleItem.innerHTML = `
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm truncate">${escapeHtml(rule.name || 'Untitled rule')}</div>
            <div class="text-xs text-gray-500 truncate">${escapeHtml(rule.pattern)}</div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge ${rule.enabled ? 'badge-green' : 'badge-gray'}">${rule.enabled ? 'ON' : 'OFF'}</span>
            <button class="delete-btn text-red-500 hover:text-red-700" title="Delete rule">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        `;

        ruleItem.addEventListener('click', () => {
          selectRule(rule.id);
        });

        const deleteBtn = ruleItem.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Delete rule "${rule.name || 'Untitled rule'}"?`)) {
            await deleteRule(rule.id);
            await refresh();
            // If deleted rule was selected, clear selection
            if (getSelectedType() === 'rule' && getSelectedId() === rule.id) {
              clearSelection();
              renderRuleDetails(null);
            }
            flashStatus('Rule deleted', 'success');
          }
        });

        root.appendChild(ruleItem);
      });
    }
  }
}

function renderRuleDetails(rule) {
  const detailsContainer = document.getElementById('ruleDetails');
  
  if (!rule) {
    detailsContainer.innerHTML = `
      <div class="text-center text-gray-500 p-8">
        <div class="mb-4">
          <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-1">Select a rule to manage</h3>
        <p class="text-gray-500">Choose a rule from the sidebar to view and edit its details</p>
      </div>
    `;
    return;
  }

  detailsContainer.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
           <h2 class="text-lg font-medium line-clamp-1">Rule Details</h2>
        </div>
        <div class="flex items-center gap-2">
          <!-- Multi-Action Rule Header Controls -->
          ${(rule.group && getServerUrl() && rule.syncConfig?.enabled) ? `
          <div class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700 gap-1">
             <div class="flex items-center px-2 py-1 gap-2 border-r border-gray-200 dark:border-gray-700 mr-1 tooltip-container" title="Auto Sync: Pushes changes to server automatically on every edit">
                <label class="switch-sm flex items-center cursor-pointer">
                  <input type="checkbox" class="sync-autosync" ${rule.syncConfig?.autoSync ? 'checked' : ''} />
                  <span class="slider-sm"></span>
                </label>
                <span class="text-[10px] font-medium text-gray-500 uppercase tracking-tight">Auto</span>
             </div>
             
             <button class="btn btn-xs btn-ghost text-purple-600 hover:bg-purple-50 flex items-center gap-1.5 sync-now-btn" title="Sync Now" ${!rule.syncConfig?.enabled ? 'disabled' : ''}>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                <span class="text-[10px] font-bold">SYNC NOW</span>
             </button>
             
             <div class="w-2 h-2 rounded-full ml-1 mr-2 ${rule.syncConfig?.enabled ? (rule.syncConfig?.autoSync ? 'bg-green-500 animate-pulse' : 'bg-blue-500') : 'bg-gray-300'}" title="${rule.syncConfig?.enabled ? 'Sync Active' : 'Sync Disabled'}"></div>
          </div>
          ` : ''}

          <label class="switch flex items-center cursor-pointer ml-2">
            <input type="checkbox" class="enabled-toggle" ${rule.enabled ? 'checked' : ''} aria-label="Enable rule" />
            <span class="slider"></span>
          </label>
          <button class="duplicate-rule btn btn-neutral btn-sm">Duplicate</button>
        </div>
      </div>
      
      <!-- Mockzilla Server Sync Banner (BETA) -->
      ${(getShowServerSyncBanner() || (getServerUrl() && getServerUrl().trim() !== "")) ? `
      <div class="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 border border-purple-100 dark:border-purple-800/20 rounded-lg p-2 text-[11px] leading-tight text-gray-600 dark:text-gray-400 flex gap-2.5 items-center relative">
         <div class="p-1.5 bg-white dark:bg-gray-800 rounded shadow-sm border border-purple-50 dark:border-purple-800/40">
           <svg class="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
         </div>
         <div class="flex-1 flex items-center justify-between">
           <div>
             <strong class="text-purple-700 dark:text-purple-300">Server Sync (BETA):</strong>
             Store this mock data on your server. <span>(Need to configure server URL in Settings)</span>
           </div>
           <div class="flex items-center gap-3">
             <label class="flex items-center gap-1.5 cursor-pointer hover:text-purple-600 transition-colors font-medium">
                <input type="checkbox" class="sync-enabled" ${rule.syncConfig?.enabled ? 'checked' : ''} />
                <span>Enable Sync</span>
             </label>
             ${(!getServerUrl() || getServerUrl().trim() === "") ? `
             <button class="hide-banner-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1" title="Hide introduction">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
             </button>
             ` : ''}
           </div>
         </div>
      </div>
      ` : ''}
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="label block mb-1">Rule Name</label>
          <input class="name input w-full" placeholder="Rule name" value="${escapeHtml(rule.name || '')}" aria-label="Rule name" />
        </div>
        
        <div>
          <label class="label block mb-1">Group</label>
          <select class="group-select select w-full" aria-label="Select group">
            <option value="" ${rule.group === '' ? 'selected' : ''}>No Group</option>
            ${window.currentGroups?.map(group => 
              `<option value="${escapeHtml(group.id)}" ${rule.group === group.id ? 'selected' : ''}>${escapeHtml(group.name)}</option>`
            ).join('')}
          </select>
        </div>
        
        <div class="col-span-3">
          <label class="label block mb-1">Match Type</label>
          <select class="matchType select w-full" aria-label="Match type">
            <option value="substring" ${rule.matchType === 'substring' ? 'selected' : ''}>Substring</option>
            <option value="exact" ${rule.matchType === 'exact' ? 'selected' : ''}>Exact</option>
            <option value="wildcard" ${rule.matchType === 'wildcard' ? 'selected' : ''}>Wildcard</option>
          </select>
          <div class="matchType-help text-xs text-gray-500 mt-2 space-y-1">
            <div class="matchType-help-pattern"></div>
            <div class="matchType-help-substring hidden"><strong>Substring</strong>: match any URL containing this text. Example: <span class="font-mono">/todos/1</span> matches <span class="font-mono">https://jsonplaceholder.typicode.com/todos/1</span></div>
            <div class="matchType-help-exact hidden"><strong>Exact</strong>: match only this full URL. Example: <span class="font-mono">https://jsonplaceholder.typicode.com/todos/1</span></div>
            <div class="matchType-help-wildcard hidden"><strong>Wildcard</strong>: each <span class="font-mono">*</span> captures a part of the URL and builds a <strong>variant key</strong> by joining captures with <span class="font-mono">|</span>. Example: <span class="font-mono">.../todos/*</span> + <span class="font-mono">.../todos/1</span> → key <span class="font-mono">1</span>. Great for multiple query params: <span class="font-mono">.../search?user=*&amp;status=*</span> → key <span class="font-mono">alice|open</span></div>
            <div class="matchType-help-wildcard-require hidden"><strong>Require variant</strong> ON: if no variant key matches, the request passes through</div>
          </div>
        </div>
        
        <div class="md:col-span-2">
          <label class="label block mb-1">URL Pattern</label>
          <input class="pattern input w-full" placeholder="URL pattern" value="${escapeHtml(rule.pattern)}" aria-label="URL pattern" />
        </div>
        
        <div>
          <label class="label block mb-1">Response Type</label>
          <select class="bodyType select w-full" aria-label="Body type">
            <option value="text" ${rule.bodyType === 'text' ? 'selected' : ''}>Text</option>
            <option value="json" ${rule.bodyType === 'json' ? 'selected' : ''}>JSON</option>
          </select>
        </div>
        
        <div>
          <label class="label block mb-1">Status Code</label>
          <select class="statusCode select w-full" aria-label="Status code">
            <option value="200" ${rule.statusCode === 200 ? 'selected' : ''}>200 OK</option>
            <option value="201" ${rule.statusCode === 201 ? 'selected' : ''}>201 Created</option>
            <option value="204" ${rule.statusCode === 204 ? 'selected' : ''}>204 No Content</option>
            <option value="400" ${rule.statusCode === 400 ? 'selected' : ''}>400 Bad Request</option>
            <option value="401" ${rule.statusCode === 401 ? 'selected' : ''}>401 Unauthorized</option>
            <option value="403" ${rule.statusCode === 403 ? 'selected' : ''}>403 Forbidden</option>
            <option value="404" ${rule.statusCode === 404 ? 'selected' : ''}>404 Not Found</option>
            <option value="422" ${rule.statusCode === 422 ? 'selected' : ''}>422 Unprocessable Entity</option>
            <option value="500" ${rule.statusCode === 500 ? 'selected' : ''}>500 Internal Server Error</option>
            <option value="502" ${rule.statusCode === 502 ? 'selected' : ''}>502 Bad Gateway</option>
            <option value="503" ${rule.statusCode === 503 ? 'selected' : ''}>503 Service Unavailable</option>
          </select>
        </div>
        

      </div>
      
      <div>
        <label class="label block mb-1">Response Body</label>
        <textarea class="body textarea" placeholder="Replacement body" aria-label="Replacement body">${escapeHtml(rule.body)}</textarea>
        <div class="validation text-xs text-red-600 mt-1 hidden" data-error="json" role="alert"></div>
      </div>
      <div class="wildcard-section ${rule.matchType === 'wildcard' ? '' : 'hidden'}">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-3">
            <label class="label">Wildcard Variants</label>
            <label class="switch flex items-center cursor-pointer">
              <input type="checkbox" class="wildcard-require-match" ${rule.wildcardRequireMatch ? 'checked' : ''} aria-label="Require variant match" />
              <span class="slider ml-2"></span>
            </label>
            <span class="text-xs text-gray-500">Require variant to intercept (no key → pass through)</span>
          </div>
          <button class="add-variant btn btn-sm">Add Variant</button>
        </div>
        <div class="variants-list space-y-3">
          ${(Array.isArray(rule.variants) ? rule.variants : []).map(v => `
            <div class="variant-item border rounded p-2" data-key="${escapeHtml(v.key)}">
              <div class="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                <input class="variant-key input w-full" placeholder="Variant key (captures joined by |, e.g. alice|open)" value="${escapeHtml(v.key)}" />
                <select class="variant-bodyType select w-full">
                  <option value="text" ${v.bodyType === 'text' ? 'selected' : ''}>Text</option>
                  <option value="json" ${v.bodyType === 'json' ? 'selected' : ''}>JSON</option>
                </select>
                <select class="variant-statusCode select w-full">
                  <option value="200" ${v.statusCode === 200 ? 'selected' : ''}>200</option>
                  <option value="201" ${v.statusCode === 201 ? 'selected' : ''}>201</option>
                  <option value="204" ${v.statusCode === 204 ? 'selected' : ''}>204</option>
                  <option value="400" ${v.statusCode === 400 ? 'selected' : ''}>400</option>
                  <option value="401" ${v.statusCode === 401 ? 'selected' : ''}>401</option>
                  <option value="403" ${v.statusCode === 403 ? 'selected' : ''}>403</option>
                  <option value="404" ${v.statusCode === 404 ? 'selected' : ''}>404</option>
                  <option value="422" ${v.statusCode === 422 ? 'selected' : ''}>422</option>
                  <option value="500" ${v.statusCode === 500 ? 'selected' : ''}>500</option>
                  <option value="502" ${v.statusCode === 502 ? 'selected' : ''}>502</option>
                  <option value="503" ${v.statusCode === 503 ? 'selected' : ''}>503</option>
                </select>
                <button class="variant-delete btn btn-sm btn-danger">Delete</button>
              </div>
              <textarea class="variant-body textarea" placeholder="Variant body">${escapeHtml(v.body || '')}</textarea>
            </div>
          `).join('')}
          ${(!Array.isArray(rule.variants) || rule.variants.length === 0) ? '<div class="text-xs text-gray-500">No variants. Use Add Variant.</div>' : ''}
        </div>
      </div>
    </div>
  `;

  // Wire up the event listeners
  const nameEl = detailsContainer.querySelector('.name');
  const groupSelectEl = detailsContainer.querySelector('.group-select');
  const matchTypeEl = detailsContainer.querySelector('.matchType');
  const patternEl = detailsContainer.querySelector('.pattern');
  const bodyTypeEl = detailsContainer.querySelector('.bodyType');
  const statusCodeEl = detailsContainer.querySelector('.statusCode');
  const bodyEl = detailsContainer.querySelector('.body');
  const responseBodySection = bodyEl ? bodyEl.parentElement : null;
  const enabledToggle = detailsContainer.querySelector('.enabled-toggle');
  const duplicateBtn = detailsContainer.querySelector('.duplicate-rule');
  const wildcardSection = detailsContainer.querySelector('.wildcard-section');
  const addVariantBtn = detailsContainer.querySelector('.add-variant');
  const variantsListEl = detailsContainer.querySelector('.variants-list');
  const wildcardRequireMatchEl = detailsContainer.querySelector('.wildcard-require-match');
  
  const syncEnabledEl = detailsContainer.querySelector('.sync-enabled');
  const syncAutoSyncEl = detailsContainer.querySelector('.sync-autosync');
  const syncNowBtn = detailsContainer.querySelector('.sync-now-btn');
  const hideBannerBtn = detailsContainer.querySelector('.hide-banner-btn');

  const updateMatchTypeHelp = () => {
    const helpPattern = detailsContainer.querySelector('.matchType-help-pattern');
    const helpSubstring = detailsContainer.querySelector('.matchType-help-substring');
    const helpExact = detailsContainer.querySelector('.matchType-help-exact');
    const helpWildcard = detailsContainer.querySelector('.matchType-help-wildcard');
    const helpWildcardRequire = detailsContainer.querySelector('.matchType-help-wildcard-require');

    if (!helpPattern) return;

    const matchType = matchTypeEl.value;
    const pattern = patternEl.value;

    helpSubstring?.classList.toggle('hidden', matchType !== 'substring');
    helpExact?.classList.toggle('hidden', matchType !== 'exact');
    helpWildcard?.classList.toggle('hidden', matchType !== 'wildcard');
    helpWildcardRequire?.classList.toggle('hidden', matchType !== 'wildcard' || !wildcardRequireMatchEl?.checked);

    if (matchType === 'wildcard') {
      const stars = (pattern.match(/\*/g) || []).length;
      if (stars === 0) {
        helpPattern.innerHTML = '<span class="text-amber-600">⚠️ No wildcards found in pattern.</span>';
      } else {
        helpPattern.innerHTML = `<span class="text-blue-600 font-medium">✨ Pattern has ${stars} wildcard ${stars === 1 ? 'part' : 'parts'}. Captured keys will be joined by "|".</span>`;
      }
    } else {
      helpPattern.textContent = '';
    }
  };

  nameEl.addEventListener('blur', async () => {
    rule.name = nameEl.value;
    await setRuleMeta(rule);
    renderRulesList(window.currentRules || [], window.currentGroups || []); // Update the sidebar
    flashStatus('Name saved', 'success');
  });

  groupSelectEl.addEventListener('change', async () => {
    rule.group = groupSelectEl.value;
    await setRuleMeta(rule);
    renderRulesList(window.currentRules || [], window.currentGroups || []); // Update the sidebar
    renderRuleDetails(rule); // Re-render details to show/hide sync UI
    flashStatus('Group updated', 'success');
  });

  matchTypeEl.addEventListener('change', async () => {
    rule.matchType = matchTypeEl.value;
    if (rule.matchType === 'wildcard' && rule.wildcardRequireMatch !== false) {
      rule.wildcardRequireMatch = true;
      if (bodyEl) bodyEl.value = '';
      await setRuleBody(rule.id, '');
    }
    await setRuleMeta(rule);
    flashStatus('Match type updated', 'success');
    if (wildcardSection) {
      if (rule.matchType === 'wildcard') wildcardSection.classList.remove('hidden');
      else wildcardSection.classList.add('hidden');
    }
    if (responseBodySection) {
      const hideBody = rule.matchType === 'wildcard' && !!rule.wildcardRequireMatch;
      responseBodySection.classList.toggle('hidden', hideBody);
    }
    updateMatchTypeHelp();
  });

  if (wildcardRequireMatchEl) {
    wildcardRequireMatchEl.addEventListener('change', async () => {
      rule.wildcardRequireMatch = !!wildcardRequireMatchEl.checked;
      await setRuleMeta(rule);
      flashStatus('Wildcard matching updated', 'success');
      updateMatchTypeHelp();
      if (responseBodySection) {
        const hideBody = rule.matchType === 'wildcard' && !!rule.wildcardRequireMatch;
        responseBodySection.classList.toggle('hidden', hideBody);
      }
      if (rule.wildcardRequireMatch) {
        if (bodyEl) {
          bodyEl.value = '';
        }
        await setRuleBody(rule.id, '');
      }
    });
  }

  if (duplicateBtn) {
    duplicateBtn.addEventListener('click', async () => {
      await duplicateRule(rule.id);
    });
  }

  if (responseBodySection) {
    const initialHide = rule.matchType === 'wildcard' && !!rule.wildcardRequireMatch;
    responseBodySection.classList.toggle('hidden', initialHide);
  }

  updateMatchTypeHelp();

  patternEl.addEventListener('blur', async () => {
    rule.pattern = patternEl.value;
    await setRuleMeta(rule);
    flashStatus('Pattern saved', 'success');
    updateMatchTypeHelp();
  });

  patternEl.addEventListener('input', () => {
    updateMatchTypeHelp();
  });

  statusCodeEl.addEventListener('change', async () => {
    rule.statusCode = parseInt(statusCodeEl.value, 10);
    await setRuleMeta(rule);
    flashStatus('Status code updated', 'success');
  });

  enabledToggle.addEventListener('change', async () => {
    rule.enabled = enabledToggle.checked;
    await setRuleMeta(rule);
    renderRulesList(window.currentRules || [], window.currentGroups || []); // Update the sidebar display
    flashStatus(rule.enabled ? 'Rule enabled' : 'Rule disabled', 'success');
  });

  bodyTypeEl.addEventListener('change', async () => {
    rule.bodyType = bodyTypeEl.value;
    await setRuleMeta(rule);
    // Revalidate JSON when switching types
    const errorEl = detailsContainer.querySelector('[data-error="json"]');
    if (errorEl) errorEl.classList.add('hidden');
    bodyEl.removeAttribute('aria-invalid');
    bodyEl.classList.remove('ring-1','ring-red-300','border-red-500','ring-green-300','border-green-500');
    flashStatus('Body type updated', 'success');
  });

  bodyEl.addEventListener('blur', async () => {
    rule.body = bodyEl.value;
    await setRuleBody(rule.id, rule.body);
    if (rule.bodyType === 'json') {
      const ok = isValidJSON(rule.body);
      const errorEl = detailsContainer.querySelector('[data-error="json"]');
      if (!ok) {
        bodyEl.setAttribute('aria-invalid','true');
        bodyEl.classList.remove('ring-green-300','border-green-500');
        bodyEl.classList.add('ring-1','ring-red-300','border-red-500');
        if (errorEl) { errorEl.textContent = 'Invalid JSON. It will be returned as text.'; errorEl.classList.remove('hidden'); }
        flashStatus('Invalid JSON', 'error');
      } else {
        bodyEl.removeAttribute('aria-invalid');
        bodyEl.classList.remove('ring-1','ring-red-300','border-red-500');
        bodyEl.classList.add('ring-green-300','border-green-500');
        if (errorEl) { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
        flashStatus('Body saved', 'success');
      }
    } else {
      flashStatus('Body saved', 'success');
    }
  });

  if (addVariantBtn) {
    addVariantBtn.addEventListener('click', async () => {
      const newVar = { key: '', bodyType: rule.bodyType, statusCode: rule.statusCode, body: '' };
      rule.variants = Array.isArray(rule.variants) ? rule.variants.slice() : [];
      rule.variants.push(newVar);
      await setRuleVariantsMeta(rule.id, rule.variants);
      renderRuleDetails(rule);
      flashStatus('Variant added', 'success');
    });
  }

  if (variantsListEl) {
    variantsListEl.querySelectorAll('.variant-item').forEach(item => {
      const keyInput = item.querySelector('.variant-key');
      const bodyTypeInput = item.querySelector('.variant-bodyType');
      const statusCodeInput = item.querySelector('.variant-statusCode');
      const bodyInput = item.querySelector('.variant-body');
      const deleteBtn = item.querySelector('.variant-delete');
      const getIdx = () => (rule.variants || []).findIndex(v => String(v.key) === String(item.getAttribute('data-key') || ''));

      keyInput.addEventListener('blur', async () => {
        const idx = getIdx();
        if (idx >= 0) {
          rule.variants[idx].key = keyInput.value;
          await setRuleVariantsMeta(rule.id, rule.variants);
          item.setAttribute('data-key', keyInput.value);
          renderRulesList(window.currentRules || [], window.currentGroups || []);
          flashStatus('Variant key saved', 'success');
          triggerAutoSync();
        }
      });

      bodyTypeInput.addEventListener('change', async () => {
        const idx = getIdx();
        if (idx >= 0) {
          rule.variants[idx].bodyType = bodyTypeInput.value;
          await setRuleVariantsMeta(rule.id, rule.variants);
          flashStatus('Variant type updated', 'success');
          triggerAutoSync();
        }
      });

      statusCodeInput.addEventListener('change', async () => {
        const idx = getIdx();
        if (idx >= 0) {
          rule.variants[idx].statusCode = parseInt(statusCodeInput.value, 10);
          await setRuleVariantsMeta(rule.id, rule.variants);
          flashStatus('Variant status updated', 'success');
          triggerAutoSync();
        }
      });

      bodyInput.addEventListener('blur', async () => {
        const idx = getIdx();
        if (idx >= 0) {
          rule.variants[idx].body = bodyInput.value;
          await setRuleVariantBody(rule.id, rule.variants[idx].key, rule.variants[idx].body);
          if (bodyTypeInput.value === 'json') {
            const ok = isValidJSON(bodyInput.value);
            if (!ok) {
              flashStatus('Invalid JSON', 'error');
            } else {
              flashStatus('Variant body saved', 'success');
              triggerAutoSync();
            }
          } else {
            flashStatus('Variant body saved', 'success');
            triggerAutoSync();
          }
        }
      });

      deleteBtn.addEventListener('click', async () => {
        const delKey = item.getAttribute('data-key') || '';
        await deleteRuleVariant(rule.id, delKey);
        rule.variants = (rule.variants || []).filter(v => String(v.key) !== String(delKey));
        renderRuleDetails(rule);
        flashStatus('Variant deleted', 'success');
        triggerAutoSync();
      });
    });
  }
  
  // Sync Event Listeners
  if (syncEnabledEl) {
    syncEnabledEl.addEventListener('change', async () => {
      if (!rule.syncConfig) rule.syncConfig = { enabled: false, method: 'GET', autoSync: false };
      rule.syncConfig.enabled = syncEnabledEl.checked;
      await setRuleMeta(rule);
      
      // Update window.currentRules to keep state in sync
      const idx = (window.currentRules || []).findIndex(r => r.id === rule.id);
      if (idx >= 0) window.currentRules[idx] = { ...rule };
      
      flashStatus('Sync settings updated', 'success');
      renderRuleDetails(rule); // Re-render to update dot and button state
      
      // Fire auto sync if enabled
      if (rule.syncConfig.enabled && rule.syncConfig.autoSync) {
         autoSyncRule(rule);
      }
    });
  }

  if (syncAutoSyncEl) {
    syncAutoSyncEl.addEventListener('change', async () => {
      if (!rule.syncConfig) rule.syncConfig = { enabled: false, method: 'GET', autoSync: false };
      rule.syncConfig.autoSync = syncAutoSyncEl.checked;
      await setRuleMeta(rule);
      
      // Update window.currentRules to keep state in sync
      const idx = (window.currentRules || []).findIndex(r => r.id === rule.id);
      if (idx >= 0) window.currentRules[idx] = { ...rule };
      
      flashStatus('Auto-sync settings updated', 'success');
      renderRuleDetails(rule); // Re-render to update dot state
      autoSyncRule(rule);
    });
  }

  if (syncNowBtn) {
     syncNowBtn.addEventListener('click', async () => {
        const originalText = syncNowBtn.innerHTML;
        syncNowBtn.disabled = true;
        syncNowBtn.innerHTML = 'SYNCING...';
        try {
            await manualSyncRule(rule);
        } finally {
            syncNowBtn.disabled = !rule.syncConfig?.enabled;
            syncNowBtn.innerHTML = originalText;
        }
     });
  }

  if (hideBannerBtn) {
    hideBannerBtn.addEventListener('click', () => {
      setShowServerSyncBanner(false);
      renderRuleDetails(rule);
    });
  }
  
  // Also hook into other change events to trigger autoSync
  const triggerAutoSync = async () => {
      // Small delay to ensure blur/change event value has propagated to rule object if not already
      setTimeout(() => autoSyncRule(rule), 50);
  };
  
  nameEl.addEventListener('blur', triggerAutoSync);
  if (groupSelectEl) groupSelectEl.addEventListener('change', triggerAutoSync);
  patternEl.addEventListener('blur', triggerAutoSync);
  statusCodeEl.addEventListener('change', triggerAutoSync);
  enabledToggle.addEventListener('change', triggerAutoSync);
  bodyEl.addEventListener('blur', triggerAutoSync);
  if (addVariantBtn) addVariantBtn.addEventListener('click', () => setTimeout(triggerAutoSync, 150));
}

function renderGroupDetails(group) {
  const detailsContainer = document.getElementById('ruleDetails');
  
  if (!group) {
    detailsContainer.innerHTML = `
      <div class="text-center text-gray-500 p-8">
        <div class="mb-4">
          <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-1">Select a rule or group to manage</h3>
        <p class="text-gray-500">Choose a rule or group from the sidebar to view and edit its details</p>
      </div>
    `;
    return;
  }

  detailsContainer.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-medium text-gray-900">Group Details</h2>
      </div>
      
      <div class="space-y-4">
        <div>
          <label class="label block mb-1">Group Name</label>
          <input class="group-name input w-full" placeholder="Group name" value="${escapeHtml(group.name)}" aria-label="Group name" />
        </div>
        
        <div>
          <label class="label block mb-1">Description</label>
          <textarea class="group-description textarea" placeholder="Group description">${escapeHtml(group.description)}</textarea>
        </div>
        
        <div>
          <label class="label block mb-1">Rules in this Group</label>
          <div class="border rounded p-2 bg-gray-800 max-h-60 overflow-y-auto">
            ${(window.currentRules || [])
              .filter(rule => rule.group === group.id)
              .map(rule => 
                `<div class="p-2 border-b border-gray-200 flex justify-between items-center">
                  <div class="truncate">${escapeHtml(rule.name || 'Untitled rule')}</div>
                  <span class="text-xs ${rule.enabled ? 'text-green-500' : 'text-gray-400'}">${rule.enabled ? 'ON' : 'OFF'}</span>
                </div>`
              ).join('') || '<div class="text-gray-500 text-center py-2">No rules in this group</div>'}
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire up the event listeners
  const nameEl = detailsContainer.querySelector('.group-name');
  const descriptionEl = detailsContainer.querySelector('.group-description');

  nameEl.addEventListener('blur', async (e) => {
    group.name = nameEl.value;
    await setGroup(group);
    renderRulesList(window.currentRules || [], window.currentGroups || []);
    flashStatus('Group name saved', 'success');
  });

  descriptionEl.addEventListener('blur', async (e) => {
    group.description = descriptionEl.value;
    await setGroup(group);
    flashStatus('Group description saved', 'success');
  });
}

function renderFolderImportModal(foldersData, onPageChange, onImport) {
  let modal = document.getElementById('serverImportModal');
  if (!modal) {
    // Create modal if it doesn't exist
    modal = document.createElement('div');
    modal.id = 'serverImportModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Import Folder from Server</h3>
          <button id="closeServerImport" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="p-4 overflow-y-auto flex-1" id="serverFoldersList">
          <!-- Folders render here -->
        </div>
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
            <div class="flex items-center gap-2">
                 <button id="serverFolderPrev" class="btn btn-sm btn-ghost" disabled>Previous</button>
                 <span id="serverFolderPageInfo" class="text-xs text-gray-500">Page 1</span>
                 <button id="serverFolderNext" class="btn btn-sm btn-ghost" disabled>Next</button>
            </div>
          <button id="cancelServerImport" class="btn btn-ghost mr-2">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Bind close events
    document.getElementById('closeServerImport').addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('cancelServerImport').addEventListener('click', () => modal.classList.add('hidden'));
  }
  
  // Render Content
  const listContainer = document.getElementById('serverFoldersList');
  const prevBtn = document.getElementById('serverFolderPrev');
  const nextBtn = document.getElementById('serverFolderNext');
  const pageInfo = document.getElementById('serverFolderPageInfo');

  if (!foldersData) {
      listContainer.innerHTML = '<div class="text-center p-4 text-gray-500">Loading...</div>';
      return;
  }

  // Clear old listeners by cloning (simple way to reset without complex cleanup)
  const newPrev = prevBtn.cloneNode(true);
  prevBtn.parentNode.replaceChild(newPrev, prevBtn);
  const newNext = nextBtn.cloneNode(true);
  nextBtn.parentNode.replaceChild(newNext, nextBtn);

  const { data, meta } = foldersData;
  listContainer.innerHTML = '';
  
  if (data.length === 0) {
      listContainer.innerHTML = '<div class="text-center p-4 text-gray-500">No folders found on server.</div>';
  } else {
      data.forEach(folder => {
          const item = document.createElement('div');
          item.className = 'p-3 border rounded border-gray-200 dark:border-gray-700 mb-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center group';
          item.innerHTML = `
            <div class="min-w-0">
                <div class="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">${escapeHtml(folder.name)}</div>
                <div class="text-xs text-gray-500 truncate">${escapeHtml(folder.description || 'No description')}</div>
            </div>
            <button class="btn btn-sm btn-primary opacity-0 group-hover:opacity-100 transition-opacity">Import</button>
          `;
          item.addEventListener('click', () => onImport(folder.id));
          listContainer.appendChild(item);
      });
  }

  // Pagination Logic
  pageInfo.textContent = `Page ${meta.page} of ${meta.totalPages}`;
  newPrev.disabled = meta.page <= 1;
  newNext.disabled = meta.page >= meta.totalPages;

  newPrev.addEventListener('click', () => onPageChange(meta.page - 1));
  newNext.addEventListener('click', () => onPageChange(meta.page + 1));
}

export { renderRulesList, renderRuleDetails, renderGroupDetails, groupExpandedState, renderFolderImportModal };

