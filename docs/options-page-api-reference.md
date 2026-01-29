# Options Page API Reference

This document provides detailed API documentation for all modules in the Mockzilla options page.

## Main Module (`src/optionsPage/main.js`)

### `initializeEventListeners()`
Sets up all UI event listeners for the options page.

### `initializeToggleRuleButton()`
Configures the global enable/disable toggle button.

### `initializeHeaderControls()`
Sets up header controls and functionality.

## Rule Manager Module (`src/optionsPage/ruleManager.js`)

### `selectRule(ruleId)`
Selects a rule for editing in the details panel.

**Parameters:**
- `ruleId` (string): The ID of the rule to select

### `selectGroup(groupId)`
Selects a group for editing in the details panel.

**Parameters:**
- `groupId` (string): The ID of the group to select

### `refresh()`
Reloads all rules and groups from storage and updates the UI.

**Returns:** Promise<void>

### `addRule()`
Creates a new rule with default values and adds it to storage.

**Returns:** Promise<void>

### `addGroup(name, description)`
Creates a new group and adds it to storage.

**Parameters:**
- `name` (string): The name of the group
- `description` (string): The description of the group

**Returns:** Promise<void>

### `duplicateRule(ruleId)`
Creates a copy of an existing rule.

**Parameters:**
- `ruleId` (string): The ID of the rule to duplicate

**Returns:** Promise<void>

### `expandAll()`
Expands all groups in the UI.

### `collapseAll()`
Collapses all groups in the UI.

## Storage Module (`src/optionsPage/storage.js`)

### `getRules()`
Retrieves all rules from storage.

**Returns:** Promise<Array<Object>> - Array of rule objects

### `getGroups()`
Retrieves all groups from storage.

**Returns:** Promise<Array<Object>> - Array of group objects

### `setRule(rule)`
Saves a rule to storage.

**Parameters:**
- `rule` (Object): The rule object to save

**Returns:** Promise<void>

### `setGroup(group)`
Saves a group to storage.

**Parameters:**
- `group` (Object): The group object to save

**Returns:** Promise<void>

### `deleteRule(ruleId)`
Removes a rule from storage.

**Parameters:**
- `ruleId` (string): The ID of the rule to delete

**Returns:** Promise<void>

### `deleteGroup(groupId)`
Removes a group from storage.

**Parameters:**
- `groupId` (string): The ID of the group to delete

**Returns:** Promise<void>

### `setEnabled(enabled)`
Sets the global extension enabled state.

**Parameters:**
- `enabled` (boolean): Whether the extension is enabled

**Returns:** Promise<void>

## State Management Module (`src/optionsPage/state.js`)

### `setSelectedRule(ruleId)`
Sets the currently selected rule.

**Parameters:**
- `ruleId` (string): The ID of the rule to select

### `setSelectedGroup(groupId)`
Sets the currently selected group.

**Parameters:**
- `groupId` (string): The ID of the group to select

### `getSelectedId()`
Gets the ID of the currently selected item.

**Returns:** string|null - The selected item ID or null

### `getSelectedType()`
Gets the type of the currently selected item.

**Returns:** string|null - 'rule', 'group', or null

### `setGroupExpanded(groupId, isExpanded)`
Sets the expansion state for a group.

**Parameters:**
- `groupId` (string): The ID of the group
- `isExpanded` (boolean): Whether the group is expanded

### `getGroupExpanded(groupId)`
Gets the expansion state for a group.

**Parameters:**
- `groupId` (string): The ID of the group

**Returns:** boolean - Whether the group is expanded

### `getTheme()`
Gets the current theme preference.

**Returns:** string - 'light' or 'dark'

### `setTheme(theme)`
Sets the theme preference.

**Parameters:**
- `theme` (string): 'light' or 'dark'

### `getDensity()`
Gets the current density preference.

**Returns:** string - 'comfortable' or 'compact'

### `setDensity(density)`
Sets the density preference.

**Parameters:**
- `density` (string): 'comfortable' or 'compact'

### `getSortOrder()`
Gets the current sort order preference.

**Returns:** string - 'recent', 'az', or 'enabled'

### `setSortOrder(order)`
Sets the sort order preference.

**Parameters:**
- `order` (string): 'recent', 'az', or 'enabled'

### `getFilterStatus()`
Gets the current filter status preference.

**Returns:** string - 'all', 'enabled', or 'disabled'

### `setFilterStatus(status)`
Sets the filter status preference.

**Parameters:**
- `status` (string): 'all', 'enabled', or 'disabled'

### `getSearchQuery()`
Gets the current search query.

**Returns:** string - The search query

### `setSearchQuery(q)`
Sets the search query.

**Parameters:**
- `q` (string): The search query

## UI Rendering Module (`src/optionsPage/ui.js`)

### `renderRulesList(rules, groups)`
Renders the main rules list with groups and rules.

**Parameters:**
- `rules` (Array<Object>): Array of rule objects
- `groups` (Array<Object>): Array of group objects

### `renderRuleDetails(rule)`
Renders the rule details panel.

**Parameters:**
- `rule` (Object|null): The rule object to render or null for default message

### `renderGroupDetails(group)`
Renders the group details panel.

**Parameters:**
- `group` (Object|null): The group object to render or null for default message

### `renderFolderImportModal()`
Shows the folder import modal for server sync functionality.

## Utilities Module (`src/optionsPage/utils.js`)

### `uid()`
Generates a unique identifier.

**Returns:** string - A unique 8-character string

### `isValidJSON(text)`
Validates if a string is valid JSON.

**Parameters:**
- `text` (string): The string to validate

**Returns:** boolean - Whether the string is valid JSON

### `escapeHtml(str)`
Escapes HTML entities in a string.

**Parameters:**
- `str` (string): The string to escape

**Returns:** string - The escaped string

### `flashStatus(message, type, timeout)`
Shows a status message to the user.

**Parameters:**
- `message` (string): The message to display
- `type` (string): 'info', 'success', or 'error' (default: 'info')
- `timeout` (number): Duration in ms (default: 2000)

### `debounce(fn, wait)`
Creates a debounced function that delays execution.

**Parameters:**
- `fn` (Function): The function to debounce
- `wait` (number): Delay in ms (default: 200)

**Returns:** Function - The debounced function

### `showToast(message, type, timeout)`
Displays a toast notification.

**Parameters:**
- `message` (string): The message to display
- `type` (string): 'info', 'success', or 'error' (default: 'info')
- `timeout` (number): Duration in ms (default: 2000)