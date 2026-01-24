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
  // Create a minimal representation that excludes internal properties
  const rulesForExport = rules.map(rule => ({
    id: rule.id,
    name: rule.name,
    matchType: rule.matchType,
    pattern: rule.pattern,
    enabled: rule.enabled,
    bodyType: rule.bodyType,
    group: rule.group, // Include group information
    statusCode: rule.statusCode,
    body: rule.body,
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
  try{
    await refresh();
    flashStatus(`Imported ${importedRules.length} rules and ${importedGroups.length} groups`, 'success');
  } catch (e) {
    console.error('Import error:', e);
    flashStatus(`Import failed: ${e.message}`, 'error');
  }
}

// Auto-sync wrapper
async function autoSyncRule(rule) {
  if (rule?.syncConfig?.autoSync && rule.enabled && rule.matchType === 'substring' && rule.syncConfig.enabled) {
    // Debounce or just fire? Fire for now.
    // We need to fetch the latest groups to ensure we have the group name.
    const ruleWithGroup = { ...rule };
    await syncRules([ruleWithGroup]);
  }
}

// Sync Logic

async function syncRules(rules) {
  const serverUrl = getServerUrl();
  if (!serverUrl) {
    console.warn('Cannot sync: No server URL configured');
    return;
  }

  // Filter valid rules for sync
  const rulesToSync = rules.filter(r => 
    r.matchType === 'substring' && 
    r.syncConfig?.enabled
  );

  if (rulesToSync.length === 0) return;

  const groups = await getGroups();
  const groupMap = new Map(groups.map(g => [g.id, g]));

  const payloadGroups = {};

  for (const rule of rulesToSync) {
    const groupId = rule.group || 'ungrouped';
    let groupName = 'Ungrouped Rules';
    let groupDesc = '';

    if (rule.group && groupMap.has(rule.group)) {
      groupName = groupMap.get(rule.group).name;
      groupDesc = groupMap.get(rule.group).description;
    }

    if (!payloadGroups[groupId]) {
      payloadGroups[groupId] = {
        id: groupId,
        name: groupName,
        description: groupDesc,
        mocks: []
      };
    }

    payloadGroups[groupId].mocks.push({
      id: rule.id,
      name: rule.name,
      pattern: rule.pattern,
      method: rule.syncConfig.method || 'GET',
      body: rule.body,
      response: rule.body,
      statusCode: rule.statusCode,
      matchType: 'substring',
      enabled: rule.enabled
    });
  }

  const payload = {
    groups: Object.values(payloadGroups)
  };

  try {
    const res = await fetch(`${serverUrl}/api/sync/extension`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
       throw new Error(`Server returned ${res.status}`);
    }
    const json = await res.json();
    console.log('Sync success:', json);
    flashStatus('Synced to Mockzilla Server', 'success');
  } catch (e) {
    console.error('Sync failed:', e);
    flashStatus(`Sync failed: ${e.message}`, 'error');
  }
}

async function syncToServer() {
  const rules = await getRules();
  // Filter for ONLY enabled sync rules
  const syncable = rules.filter(r => r.matchType === 'substring' && r.syncConfig?.enabled);
  if (syncable.length === 0) {
    flashStatus('No rules enabled for sync', 'info');
    return;
  }
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
  syncToServer
};
