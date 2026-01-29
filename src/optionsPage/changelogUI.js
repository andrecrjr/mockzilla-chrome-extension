// UI module for handling the changelog modal and update detection
import { getLastShownChangelogVersion, setLastShownChangelogVersion } from './state.js';
import { getChangelog } from './changelog.js';

/**
 * Initializes the changelog component:
 * 1. Checks if a new version is available.
 * 2. Renders the modal if needed.
 * 3. Wires up event listeners.
 */
export async function initChangelog() {
  const currentVersion = chrome.runtime.getManifest().version;
  const lastShownVersion = getLastShownChangelogVersion();

  if (currentVersion !== lastShownVersion) {
    const data = getChangelog(currentVersion);
    if (data) {
      renderChangelogModal(data);
    }
  }

  // Wire up listeners
  const changelogModal = document.getElementById('changelogModal');
  const closeChangelogTop = document.getElementById('closeChangelogTop');
  const closeChangelogBtn = document.getElementById('closeChangelogBtn');
  const feedbackChangelogBtn = document.getElementById('feedbackChangelogBtn');

  const closeChangelog = () => {
    if (changelogModal) {
      changelogModal.classList.add('hidden');
      setLastShownChangelogVersion(currentVersion);
    }
  };

  if (closeChangelogTop) closeChangelogTop.addEventListener('click', closeChangelog);
  if (closeChangelogBtn) closeChangelogBtn.addEventListener('click', closeChangelog);
}

/**
 * Renders the changelog modal with provided data
 * @param {Object} data - Changelog data for a specific version
 */
function renderChangelogModal(data) {
  const modal = document.getElementById('changelogModal');
  const titleEl = document.getElementById('changelogTitle');
  const contentEl = document.getElementById('changelogContent');

  if (!data || !modal || !contentEl) return;

  if (titleEl && data.title) {
    titleEl.textContent = data.title;
  }

  let html = '';
  if (data.sections) {
    data.sections.forEach(section => {
      html += `<div class="mb-6 last:mb-0">
        <h4 class="text-purple-700 dark:text-purple-300 font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
          ${section.title}
        </h4>
        <ul class="space-y-3">`;
      
      section.items.forEach(item => {
        // Simple markdown-ish formatting:
        // 1. Bold: **text** -> <strong>text</strong>
        // 2. Links: [text](url) -> <a href="url" target="_blank" class="...">text</a>
        let formattedItem = item
          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900 dark:text-white">$1</strong>')
          .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium underline decoration-purple-500/30 underline-offset-2">$1</a>');

        html += `<li class="flex gap-3 text-sm text-gray-600 dark:text-gray-400">
          <span class="text-purple-500 mt-1 flex-shrink-0">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
          </span>
          <span>${formattedItem}</span>
        </li>`;
      });
      
      html += `</ul></div>`;
    });
  }

  contentEl.innerHTML = html;
  modal.classList.remove('hidden');
}
