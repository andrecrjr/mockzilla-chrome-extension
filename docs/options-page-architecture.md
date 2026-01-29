# Options Page Architecture

The Mockzilla options page is a comprehensive rule management interface that allows users to create, edit, and organize request interception rules. This document details the architecture and functionality of the options page.

## Overview

The options page serves as the primary user interface for managing mock rules and groups. It's built as a modular, single-page application using native ES6 modules and follows Chrome Extension Manifest V3 best practices.

## Module Structure

The options page is composed of several interconnected modules:

### 1. Main Module (`src/optionsPage/main.js`)
- Entry point for the options page
- Initializes the UI and sets up all event listeners
- Coordinates between different modules
- Handles DOMContentLoaded event to bootstrap the application

### 2. Rule Manager (`src/optionsPage/ruleManager.js`)
- Core business logic for rule and group operations
- Handles CRUD operations for rules and groups
- Manages selection state and UI updates
- Coordinates with storage module for persistence

### 3. Storage Module (`src/optionsPage/storage.js`)
- Abstraction layer for Chrome storage APIs
- Handles both `chrome.storage.sync` and `chrome.storage.local`
- Manages rule metadata and body storage separately
- Implements data validation and backward compatibility

### 4. State Management (`src/optionsPage/state.js`)
- Centralized application state management
- Handles UI preferences (theme, density, sorting, etc.)
- Manages selection state (currently selected rule/group)
- Tracks group expansion states

### 5. UI Rendering (`src/optionsPage/ui.js`)
- Responsible for all DOM manipulation and rendering
- Renders rules list, group list, and detail panels
- Handles dynamic UI updates based on application state
- Implements search, filtering, and sorting functionality

### 6. Utilities (`src/optionsPage/utils.js`)
- Common utility functions used across modules
- Includes UID generation, HTML escaping, JSON validation
- Toast notification system implementation
- Debounce helper for performance optimization

### 7. Changelog System (`src/optionsPage/changelog.js` and `changelogUI.js`)
- Version-specific update information
- Modal display for new feature announcements
- Automatic detection of version changes

## Key Features

### Rule Management
- Create, edit, delete, and duplicate rules
- Support for multiple match types (exact, substring, wildcard)
- Status code customization
- Multiple response body types (JSON, text, HTML)

### Group Organization
- Organize rules into named groups/folders
- Expand/collapse groups for better organization
- Visual indicators for group contents

### Variants System
- Support for multiple response variants per rule
- Dynamic body content based on variant selection
- Local storage for variant-specific content

### UI Customization
- Light/dark theme support
- Comfortable/compact density options
- Sortable rule lists (by name, status, recency)
- Search and filter capabilities

### Server Synchronization (Beta)
- Integration with Mockzilla server for team collaboration
- Import/export functionality for rule sharing
- Folder-based organization for team workflows

## Data Flow

### Rule Creation Process
1. User clicks "Add Rule" button
2. Main module triggers `addRule()` in ruleManager
3. Rule manager creates new rule object with default values
4. Storage module persists the new rule to Chrome storage
5. UI is refreshed to show the new rule
6. New rule is automatically selected for editing

### Rule Selection Process
1. User clicks on a rule in the list
2. UI module calls selection function in ruleManager
3. Rule manager updates internal selection state
4. UI module renders the rule details in the detail panel
5. Appropriate form fields are populated with rule data

### Storage Strategy
The options page implements a split-storage approach:
- **Metadata** (name, pattern, match type, etc.) stored in `chrome.storage.sync`
- **Body content** stored in `chrome.storage.local` to avoid sync quota limits
- **Variants** stored separately in local storage with reference keys

## Event Handling

The options page uses a combination of direct event listeners and centralized event handling:

- Button clicks are handled by direct listeners in the main module
- Form changes are debounced and persisted automatically
- Storage changes trigger refresh operations across the UI
- Cross-module communication happens through shared state and direct function calls

## Performance Considerations

- Debounced storage operations to prevent excessive Chrome storage writes
- Efficient DOM updates with minimal re-rendering
- Lazy loading of rule bodies when needed
- Memory-efficient handling of large rule sets

## Error Handling

- Validation of JSON content before saving
- Graceful degradation when Chrome storage is unavailable
- User-friendly error messages through toast notifications
- Console logging for debugging purposes

## Future Extensibility

The modular architecture allows for easy addition of new features:
- New rule types can be added with minimal changes to existing code
- Additional storage backends could be integrated
- New UI themes and layouts can be implemented without changing business logic
- Plugin system could be added to extend functionality