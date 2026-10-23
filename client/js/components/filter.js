/* ============================================================
   js/components/filter.js — Category Filter Pills Component
   Renders filter pills and fires filter events on selection
   ============================================================ */

const Filter = {
  // Currently active category filter (null = all)
  active: 'all',

  /**
   * Initialise filter pills in a container element.
   * @param {string}   containerId  - ID of the filter pill wrapper
   * @param {Array}    categories   - Category objects/strings from API
   * @param {Function} onChange     - Callback(category) fired on pill click
   */
  init(containerId, categories = [], onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Build pills HTML
    let html = `<button class="filter-pill active" data-cat="all">All</button>`;
    const escapeHtml = window.Helpers.escapeHtml;
    categories.forEach(cat => {
      // Support both string and object formats
      const name = typeof cat === 'string' ? cat : cat.name;
      const safeName = escapeHtml(name || '');
      html += `<button class="filter-pill" data-cat="${safeName}">${safeName}</button>`;
    });
    container.innerHTML = html;

    // Click handler for each pill
    container.addEventListener('click', (e) => {
      const target = e.target && typeof e.target.closest === 'function' ? e.target : null;
      const pill = target?.closest('.filter-pill');
      if (!pill) return;

      // Deactivate all pills
      container.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      // Activate clicked pill
      pill.classList.add('active');

      // Store active filter
      this.active = pill.dataset.cat;

      // Fire callback with selected category
      if (onChange) onChange(this.active);
    });
  },

  // Programmatically set the active filter pill
  setActive(containerId, category) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.cat === category);
    });
    this.active = category;
  },
};

window.Filter = Filter;


/* ============================================================
   js/components/search.js — Search Bar Component
   Debounced input handler with live filtering callback
   ============================================================ */

const Search = {
  /**
   * Attach debounced search to an input element.
   * @param {string}   inputId    - ID of the search input element
   * @param {Function} onSearch   - Callback(query) fired on input
   * @param {number}   delay      - Debounce delay in ms (default 300)
   */
  init(inputId, onSearch, delay = 300) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Create debounced version of search callback
    const debounced = window.Helpers.debounce((e) => {
      const query = e.target.value.trim();
      onSearch(query);
    }, delay);

    // Attach to input event (fires on every keystroke)
    input.addEventListener('input', debounced);

    // Also handle Enter key for immediate search
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Cancel debounce and search immediately
        onSearch(input.value.trim());
      }
    });

    // Clear search on Escape
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        onSearch('');
      }
    });
  },
};

window.Search = Search;


/* ============================================================
   js/components/footer.js — Footer Social Links Loader
   Fetches social link data from API and updates footer DOM
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // Load footer about/social content from API
  try {
    const data = await window.api.get('/about');

    // Update footer description text if element exists
    const descEl = document.getElementById('footerDesc');
    if (descEl && data.description) {
      descEl.textContent = data.description;
    }

    // Update partners line
    const partnersEl = document.getElementById('footerPartners');
    if (partnersEl && data.partners) {
      partnersEl.textContent = `Partners: ${data.partners}`;
    }

    // Update social links
    const socialsEl = document.getElementById('footerSocials');
    if (socialsEl && data.social_links && data.social_links.length) {
      // Update href for each social button by platform name
      data.social_links.forEach(link => {
        const btn = socialsEl.querySelector(`[data-social="${link.platform}"]`);
        if (btn && link.url) btn.href = link.url;
      });
    }
  } catch (err) {
    // Silently fail — footer still renders with static defaults
  }
});
