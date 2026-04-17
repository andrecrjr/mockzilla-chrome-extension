// Rule manager module for options page - handles rule/group selection and management

import { renderRuleDetails, renderGroupDetails, renderRulesList } from './ui.js';
import { setRuleMeta, setRuleBody, setGroup, deleteGroup, deleteRule, setEnabled, getRules, getGroups, setRule } from './storage.js';
import { flashStatus, uid } from './utils.js';
import { setSelectedRule as setInternalSelectedRule, setSelectedGroup as setInternalSelectedGroup, setSelectedId, setSelectedType, getSelectedType, getSelectedId, clearSelection, setGroupExpanded, getServerUrl } from './state.js';

function selectRule(ruleId) {
  setInternalSelectedRule(ruleId);
  try {
    renderRulesList(window.currentRules || [], window.currentGroups || []);
  } catch {}
  const rule = window.currentRules?.find(r => r.id === ruleId) || null;
  renderRuleDetails(rule);
}

function selectGroup(groupId) {
  setInternalSelectedGroup(groupId);
  const group = window.currentGroups?.find(g => g.id === groupId) || null;
  renderGroupDetails(group);
}

async function refresh() {
  try {
    const rules = await getRules();
    const groups = await getGroups();
    window.currentRules = rules; // Store for later use
    window.currentGroups = groups; // Store groups for later use
    
    // Update folders count pill if present
    const countEl = document.getElementById('groupsCount');
    if (countEl) {
      countEl.textContent = `${groups.length} ${groups.length === 1 ? 'folder' : 'folders'}`;
    }

    renderRulesList(rules, groups);
    
    // Update the selected item in the details panel if it was previously selected
    if (getSelectedType() === 'rule' && getSelectedId()) {
      const selectedRule = rules.find(r => r.id === getSelectedId());
      if (selectedRule) {
        renderRuleDetails(selectedRule);
      } else {
        // If the selected rule was deleted, clear the selection
        clearSelection();
        renderRuleDetails(null);
      }
    } else if (getSelectedType() === 'group' && getSelectedId()) {
      const selectedGroup = groups.find(g => g.id === getSelectedId());
      if (selectedGroup) {
        renderGroupDetails(selectedGroup);
      } else {
        // If the selected group was deleted, clear the selection
        clearSelection();
        renderRuleDetails(null);
      }
    } else {
      // If nothing selected, render the default message
      renderRuleDetails(null);
    }
  } catch (e) {
    console.error('Error refreshing options:', e);
    const container = document.getElementById('ruleDetails');
    if (container) {
      container.innerHTML = `<div class="card p-3 text-sm text-red-700 bg-red-50 border-red-200">Error loading rules. See console for details.</div>`;
    }
  }
}

// Add rule and group functions
async function addRule() {
  const newRule = { id: uid(), name: '', matchType: 'exact', pattern: '', enabled: true, bodyType: 'json', group: '', statusCode: 200, body: '', variants: [], wildcardRequireMatch: true };
  await setRule(newRule);
  await refresh();
  // Automatically select the new rule
  selectRule(newRule.id);
  flashStatus('New rule added', 'success');
}

async function duplicateRule(ruleId) {
  const rules = await getRules();
  const orig = rules.find(r => r.id === ruleId);
  if (!orig) { flashStatus('Rule not found', 'error'); return; }
  const newId = uid();
  const cloned = {
    id: newId,
    name: '',
    matchType: orig.matchType,
    pattern: orig.pattern,
    enabled: orig.enabled,
    bodyType: orig.bodyType,
    group: orig.group || '',
    statusCode: orig.statusCode || 200,
    body: orig.body || '',
    variants: Array.isArray(orig.variants) ? orig.variants.map(v => ({ key: String(v.key || ''), bodyType: v.bodyType || orig.bodyType, statusCode: v.statusCode || orig.statusCode || 200, body: v.body || '' })) : [],
    wildcardRequireMatch: orig.wildcardRequireMatch === true,
  };
  await setRule(cloned);
  setInternalSelectedRule(newId);
  await refresh();
  flashStatus('Rule duplicated', 'success');
}

async function addGroup(groupName, groupDescription) {
  if (!groupName) {
    flashStatus('Group name is required', 'error');
    return;
  }
  
  const group = { id: uid(), name: groupName, description: groupDescription };
  await setGroup(group);
  await refresh();
  flashStatus('Group created', 'success');
}

// Expand/collapse all functionality
function expandAll() {
  // Set all groups to expanded state
  const allGroups = (window.currentGroups || []).concat([{id: 'ungrouped'}]);
  allGroups.forEach(group => {
    setGroupExpanded(group.id, true);
  });
  renderRulesList(window.currentRules, window.currentGroups);
}

function collapseAll() {
  // Set all groups to collapsed state
  const allGroups = (window.currentGroups || []).concat([{id: 'ungrouped'}]);
  allGroups.forEach(group => {
    setGroupExpanded(group.id, false);
  });
  renderRulesList(window.currentRules, window.currentGroups);
}

// Export rules functionality
async function exportRules() {
  const rules = await getRules();
  const groups = await getGroups();
  const exportedAt = new Date().toISOString();
  // Create a representation that includes all necessary properties
  const rulesForExport = rules.map(rule => ({
    id: rule.id,
    name: rule.name,
    matchType: rule.matchType,
    pattern: rule.pattern,
    enabled: rule.enabled,
    bodyType: rule.bodyType,
    group: rule.group,
    statusCode: rule.statusCode,
    body: rule.body,
    syncConfig: rule.syncConfig,
    wildcardRequireMatch: rule.wildcardRequireMatch,
    variants: Array.isArray(rule.variants) ? rule.variants.map(v => ({ key: v.key, bodyType: v.bodyType, statusCode: v.statusCode, body: v.body })) : []
  }));
  
  const groupsForExport = groups.map(group => ({
    id: group.id,
    name: group.name,
    description: group.description
  }));

  const dataStr = JSON.stringify({ exportedAt, rules: rulesForExport, groups: groupsForExport }, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

  // Include current date in the filename for clarity
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const stamp = `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
  const exportFileDefaultName = `mockzilla-rules-export_${stamp}.json`;

  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
  flashStatus('Rules and groups exported', 'success');

}

// Import rules functionality
async function importRules(importText) {
  if (!importText) {
    flashStatus('No data to import', 'error');
    return;
  }

  try {
    const importedData = JSON.parse(importText);
    let importedRules = [];
    let importedGroups = [];
    
    if (Array.isArray(importedData)) {
      // Legacy format - just rules
      importedRules = importedData;
    } else if (importedData.rules) {
      // New format with groups
      importedRules = importedData.rules || [];
      importedGroups = importedData.groups || [];
    } else if (importedData.groups && Array.isArray(importedData.groups)) {
      // Server format: { groups: [ { id, name, mocks: [] } ] }
      importedData.groups.forEach(group => {
        const groupId = group.id || group.slug || uid();
        const { mocks, ...groupData } = group;
        importedGroups.push({ ...groupData, id: groupId });

        if (mocks && Array.isArray(mocks)) {
          mocks.forEach(mock => {
            importedRules.push({
              ...mock,
              group: groupId,
              // Ensure critical fields for validation/storage
              body: mock.body || mock.response || '',
              name: mock.name || 'Untitled Mock'
            });
          });
        }
      });
    // ... existing format parsing ...
    } else {
      // Unknown format
      throw new Error('Invalid import format');
    }

    // --- NEW DEDUPLICATION LOGIC ---
    // Helper to get method consistently
    const getMethod = (r) => r.method || r.syncConfig?.method || 'GET';

    // 1. Deduplicate incoming rules by content (Pattern + Method + MatchType)
    // This ensures that if the import data itself has duplicates, we only take the best one.
    const incomingContentMap = new Map();
    importedRules.forEach(r => {
      const key = `${r.pattern}|${getMethod(r)}|${r.matchType || 'substring'}`;
      const existing = incomingContentMap.get(key);
      
      const newHasGroup = r.group && r.group !== 'ungrouped';
      const existingHasGroup = existing && existing.group && existing.group !== 'ungrouped';
      
      // Keep if: first time seeing this content, OR this version has a group and the previous didn't
      if (!existing || (!existingHasGroup && newHasGroup)) {
        incomingContentMap.set(key, r);
      }
    });
    importedRules = Array.from(incomingContentMap.values());

    // 2. Ensure every rule has an ID
    importedRules.forEach(r => { if (!r.id) r.id = uid(); });

    // Import groups first
    for (const group of importedGroups) {
      if (
        typeof group !== 'object' ||
        typeof group.id !== 'string' ||
        typeof group.name !== 'string'
      ) {
        throw new Error(`Invalid group structure: ${JSON.stringify(group)}`);
      }
      await setGroup(group);
    }

    // Fetch existing rules for deduplication check against current storage
    const existingRules = await getRules();

    // Import rules
    for (const rule of importedRules) {
      // Ensure defaults for critical fields
      if (!rule.matchType) rule.matchType = 'substring';
      if (!rule.bodyType) rule.bodyType = 'json';
      if (!rule.pattern) rule.pattern = '';
      if (rule.body === undefined) rule.body = rule.response || '';

      if (
        typeof rule !== 'object' ||
        typeof rule.id !== 'string' ||
        typeof rule.matchType !== 'string' ||
        typeof rule.pattern !== 'string' ||
        typeof rule.bodyType !== 'string' ||
        typeof rule.body !== 'string'
      ) {
        throw new Error(`Invalid rule structure: ${JSON.stringify(rule)}`);
      }
      
      // Ensure default status code if not present in import
      if (rule.statusCode === undefined) rule.statusCode = 200;
      if (!Array.isArray(rule.variants)) rule.variants = [];
      
      // 3. CROSS-STORAGE DEDUPLICATION: 
      // If we are importing a grouped rule, delete any existing ungrouped rule with the same pattern
      if (rule.group && rule.group !== 'ungrouped') {
        const duplicate = existingRules.find(r => 
          r.pattern === rule.pattern && 
          getMethod(r) === getMethod(rule) && 
          r.matchType === rule.matchType &&
          (!r.group || r.group === 'ungrouped') &&
          r.id !== rule.id
        );
        if (duplicate) {
          console.log(`[IMPORT] Removing existing ungrouped duplicate rule ${duplicate.id} for pattern ${rule.pattern}`);
          await deleteRule(duplicate.id);
        }
      }

      // If rule already exists (by ID), update it; otherwise, create a new one
      await setRule(rule);
    }

    await refresh();
    flashStatus(`Imported ${importedRules.length} rules and ${importedGroups.length} groups`, 'success');
  } catch (e) {
    console.error('Import error:', e);
    flashStatus(`Import failed: ${e.message}`, 'error');
  }
}

// Auto-sync wrapper
async function autoSyncRule(rule) {
  if (rule?.syncConfig?.autoSync && rule.enabled && rule.syncConfig.enabled) {
    // Debounce is handled by the caller or UI event loop naturally for now.
    // We MUST sync ALL rules to preserve the group state on the server, 
    // as the server wipes the folder contents on sync.
    await syncToServer();
  }
}

async function manualSyncRule(rule) {
    // We verify sync is enabled for the rule, but we don't check autoSync
    if (!rule.syncConfig?.enabled) {
         flashStatus('Enable sync for this rule first', 'error');
         return;
    }
    const ruleWithGroup = { ...rule };
    // Same as autoSync: we must sync ALL rules to avoid wiping others in the group
    await syncToServer();
}

// Sync Logic

async function syncRules(rules) {
  const serverUrl = getServerUrl();
  if (!serverUrl) {
    console.warn('[SYNC] Cannot sync: No server URL configured');
    flashStatus('Configure server URL in Cloud Actions first', 'error');
    return;
  }

  // PHASE 1 FIX: Explicit validation - rules WITHOUT groups must show error
  const ungroupedRules = rules.filter(r => r.syncConfig?.enabled && (!r.group || r.group === 'ungrouped'));
  if (ungroupedRules.length > 0) {
    const offendingNames = ungroupedRules.map(r => r.name || 'Untitled Rule').join(', ');
    console.warn('[SYNC] Validation failed: Some rules enabled for sync have no group assigned', ungroupedRules.map(r => ({ id: r.id, name: r.name })));
    flashStatus(`${ungroupedRules.length} rule(s) (${offendingNames}) need to be assigned to a group first`, 'error', 5000);
    return;
  }

  // Filter valid rules for sync
  const rulesToSync = rules.filter(r => 
    r.syncConfig?.enabled && r.group && r.group !== 'ungrouped'
  );

  if (rulesToSync.length === 0) {
    console.warn('[SYNC] No rules to sync after filtering');
    flashStatus('No rules configured for sync', 'info');
    return;
  }

  // PHASE 1 FIX: Warn if any rule has empty body
  const emptyBodyRules = rulesToSync.filter(r => !r.body || r.body.trim() === '');
  if (emptyBodyRules.length > 0) {
    console.warn(`[SYNC] Warning: ${emptyBodyRules.length} rule(s) have empty response body`);
    flashStatus(`⚠️ ${emptyBodyRules.length} rule(s) have empty response body — continuing`, 'warning');
  }

  const groups = await getGroups();
  const groupMap = new Map(groups.map(g => [g.id, g]));

  const payloadGroups = {};

  for (const rule of rulesToSync) {
    const groupId = rule.group;
    let groupName = 'Ungrouped Rules';
    let groupDesc = '';

    if (groupMap.has(groupId)) {
      groupName = groupMap.get(groupId).name;
      groupDesc = groupMap.get(groupId).description;
    }

    if (!payloadGroups[groupId]) {
      payloadGroups[groupId] = {
        id: groupId,
        name: groupName,
        description: groupDesc,
        mocks: []
      };
    }

    // PHASE 1 FIX: Include missing fields: bodyType, wildcardRequireMatch
    // PHASE 1 FIX: Remove redundant 'response' field (keep only 'body')
    payloadGroups[groupId].mocks.push({
      id: rule.id,
      name: rule.name,
      pattern: rule.pattern,
      body: rule.body || '',
      statusCode: rule.statusCode,
      matchType: rule.matchType,
      method: rule.syncConfig?.method || 'GET',
      enabled: rule.enabled,
      bodyType: rule.bodyType || 'text',
      wildcardRequireMatch: rule.wildcardRequireMatch || false,
      variants: Array.isArray(rule.variants) ? rule.variants.map(v => ({
        key: v.key,
        bodyType: v.bodyType || 'text',
        statusCode: v.statusCode,
        body: v.body || ''
      })) : []
    });
  }

  const payload = {
    groups: Object.values(payloadGroups)
  };

  // PHASE 1 FIX: Log payload structure for debugging
  console.log('[SYNC] Payload structure:', {
    groupCount: payload.groups.length,
    totalMocks: payload.groups.reduce((sum, g) => sum + g.mocks.length, 0),
    groups: payload.groups.map(g => ({ 
      id: g.id, 
      name: g.name, 
      mockCount: g.mocks.length 
    }))
  });

  try {
    console.log('[SYNC] Starting POST to', `${serverUrl}/api/sync/extension`);
    const res = await fetch(`${serverUrl}/api/sync/extension`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
       const errText = await res.text();
       throw new Error(`Server returned ${res.status}: ${errText}`);
    }
    const json = await res.json();
    console.log('[SYNC] Success response:', json);
    
    const msg = json.results ? 
      `Synced: ${json.results.foldersCreated || 0} folder(s) created, ${json.results.foldersUpdated || 0} updated, ${json.results.mocksSynced || 0} mock(s)` :
      'Synced to Mockzilla Server';
    flashStatus(msg, 'success');
  } catch (e) {
    console.error('[SYNC] Failed:', e);
    flashStatus(`Sync failed: ${e.message}`, 'error');
  }
}

async function syncToServer() {
  const rules = await getRules();
  // Filter for ONLY enabled sync rules
  const syncable = rules.filter(r => r.syncConfig?.enabled);
  if (syncable.length === 0) {
    flashStatus('No rules have sync active — enable sync on a rule first', 'warning');
    return;
  }
  
  // PHASE 1 FIX: Pre-flight validation - ensure at least one rule has a group
  const withGroups = syncable.filter(r => r.group && r.group !== 'ungrouped');
  if (withGroups.length === 0) {
    console.warn('[SYNC] Pre-flight check: No rules have groups assigned');
    flashStatus('No rules have groups assigned — assign groups before syncing', 'error');
    return;
  }
  
  console.log(`[SYNC] Pre-flight passed: ${withGroups.length}/${syncable.length} rules have groups, starting sync...`);
  await syncRules(syncable);
}

export { 
  selectRule, 
  selectGroup, 
  refresh, 
  addRule, 
  addGroup, 
  expandAll, 
  collapseAll, 
  exportRules, 
  importRules,
  duplicateRule,
  autoSyncRule,
  manualSyncRule,
  syncToServer,
  fetchServerFolders,
  importFolderFromServer
}

async function fetchServerFolders(page = 1, limit = 10) {
    const serverUrl = getServerUrl();
    if (!serverUrl) {
      flashStatus('No server URL configured', 'error');
      return null;
    }

    try {
        const res = await fetch(`${serverUrl}/api/folders?page=${page}&limit=${limit}&type=extension`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            throw new Error(`Server returned ${res.status}`);
        }

        const json = await res.json();
        return json; // Expecting { data: [...], meta: { ... } }
    } catch (e) {
        console.error('Fetch server folders failed:', e);
        flashStatus(`Fetch fail: ${e.message}`, 'error');
        return null;
    }
}

async function importFolderFromServer(folderId) {
    const serverUrl = getServerUrl();
    if (!serverUrl) {
        flashStatus('No server URL configured', 'error');
        return;
    }

    try {
        const res = await fetch(`${serverUrl}/api/folders/${folderId}/to-extension`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            throw new Error(`Server returned ${res.status}`);
        }

        const json = await res.json();
        // json should be { groups: [{ mocks: [...] }] } (SyncPayload)
        
        // Transform SyncPayload to ImportFormat
        // SyncPayload: { groups: [ { id, name, mocks: [] } ] }
        // ImportFormat: { rules: [], groups: [] }
    
        const importedRules = [];
        const importedGroups = [];

        if (json.groups && Array.isArray(json.groups)) {
            json.groups.forEach(group => {
                // Ensure we have a valid ID for the group
                const groupId = group.id || group.slug;
                if (!groupId) return;

                // Add group to list (exclude mocks to keep it clean)
                const { mocks, ...groupData } = group;
                importedGroups.push({ ...groupData, id: groupId, serverFolderId: folderId });

                // Add mocks as rules with groupId
                if (mocks && Array.isArray(mocks)) {
                    mocks.forEach(mock => {
                        const rule = { 
                            ...mock, 
                            group: groupId,
                            // Ensure sync is enabled by default for imported rules
                            syncConfig: { enabled: true, method: mock.method || 'GET', autoSync: true, serverFolderId: folderId },
                            // Map body if not present but response is (some server formats)
                            body: mock.response || mock.body || '',
                            name: mock.name || 'Untitled Mock'
                        };
                        if (!rule.matchType) rule.matchType = 'substring'; // Default
                        if (!rule.bodyType) rule.bodyType = 'json'; // Default
                        importedRules.push(rule);
                    });
                }
            });
        }

        const importPayload = {
            rules: importedRules,
            groups: importedGroups
        };

        // Reuse importRules logic
        await importRules(JSON.stringify(importPayload));
        
        flashStatus('Folder imported successfully', 'success');
        return true;
    } catch (e) {
        console.error('Import folder failed:', e);
        flashStatus(`Import failed: ${e.message}`, 'error');
        return false;
    }
}
