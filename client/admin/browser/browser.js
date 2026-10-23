let _browserCurrentUrl = '';
let _browserHistory = [];
let _browserHistoryIdx = -1;
let _browserIframeTimer = null;
let _browserSearchHistory = JSON.parse(localStorage.getItem('vavh_search_history') || '[]');

const SEARCH_ENGINES = {
  google: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  youtube: q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  bing: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  duckduckgo: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  wikipedia: q => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`,
};

function _isUrl(str) {
  str = str.trim();
  if (/^https?:\/\//i.test(str)) return true;
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/|$)/.test(str)) return true;
  return false;
}

function _buildUrl(query) {
  query = query.trim();
  if (!query) return '';
  if (_isUrl(query)) return /^https?:\/\//i.test(query) ? query : 'https://' + query;
  const engineKey = document.getElementById('browser-engine-pick')?.value
    || document.getElementById('browser-home-engine')?.value
    || 'google';
  return SEARCH_ENGINES[engineKey]
    ? SEARCH_ENGINES[engineKey](query)
    : SEARCH_ENGINES.google(query);
}

function browserNavigate(query) {
  if (!query || !query.trim()) return;
  const url = _buildUrl(query);
  _addToSearchHistory(query.trim());
  browserGo(url);
}

function browserGo(url) {
  if (!url) return;
  _browserCurrentUrl = url;
  const urlInput = document.getElementById('browser-url-input');
  if (urlInput) urlInput.value = url;

  document.getElementById('browser-home').style.display = 'none';
  const area = document.getElementById('browser-iframe-area');
  area.style.display = 'flex';
  area.style.flexDirection = 'column';

  document.getElementById('browser-blocked-msg').style.display = 'none';
  const iframe = document.getElementById('browser-iframe');
  iframe.style.display = 'none';
  iframe.src = '';

  const bar = document.getElementById('browser-loading-bar');
  if (bar) bar.style.display = 'block';

  if (_browserHistoryIdx < _browserHistory.length - 1) {
    _browserHistory = _browserHistory.slice(0, _browserHistoryIdx + 1);
  }
  _browserHistory.push(url);
  _browserHistoryIdx = _browserHistory.length - 1;
  _updateNavBtns();

  if (urlInput) urlInput.value = url;
  document.getElementById('browser-clear-btn').style.display = 'block';

  if (window.electronAPI && window.electronAPI.isElectron && window.electronAPI.isElectron()) {
    window.electronAPI.browserNavigate(url).then(result => {
      if (!result || !result.success) {
        _showBlockedMessage(url);
      }
    }).catch(() => { _showBlockedMessage(url); });
  } else {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    iframe.src = proxyUrl;

    clearTimeout(_browserIframeTimer);
    _browserIframeTimer = setTimeout(() => {
      const l = document.getElementById('browser-iframe');
      const b = document.getElementById('browser-blocked-msg');
      if (l && b) {
        l.style.display = 'none';
        b.style.display = 'flex';
        b.style.flexDirection = 'column';
        document.getElementById('browser-blocked-title').textContent = 'Loading failed';
        document.getElementById('browser-blocked-desc').textContent = `"${_browserCurrentUrl}" could not be loaded. Click below to open it directly.`;
      }
      if (bar) bar.style.display = 'none';
    }, 15000);
  }
}

function _showBlockedMessage(url) {
  const bar = document.getElementById('browser-loading-bar');
  if (bar) bar.style.display = 'none';
  const l = document.getElementById('browser-iframe');
  const b = document.getElementById('browser-blocked-msg');
  if (l && b) {
    l.style.display = 'none';
    b.style.display = 'flex';
    b.style.flexDirection = 'column';
    document.getElementById('browser-blocked-title').textContent = 'Failed to load';
    document.getElementById('browser-blocked-desc').textContent = `Could not load "${url}". Please try again or open in a new tab.`;
  }
}

function onBrowserIframeLoad() {
  clearTimeout(_browserIframeTimer);
  const bar = document.getElementById('browser-loading-bar');
  if (bar) bar.style.display = 'none';
  try {
    const iframe = document.getElementById('browser-iframe');
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc && (!doc.body || doc.body.innerHTML.trim() === '')) {
      onBrowserIframeError();
    }
  } catch (e) { }
}

function onBrowserIframeError() {
  clearTimeout(_browserIframeTimer);
  const bar = document.getElementById('browser-loading-bar');
  if (bar) bar.style.display = 'none';
  const iframe = document.getElementById('browser-iframe');
  const blocked = document.getElementById('browser-blocked-msg');
  if (iframe) iframe.style.display = 'none';
  if (blocked) {
    blocked.style.display = 'flex';
    blocked.style.flexDirection = 'column';
  }
}

function browserBack() {
  if (_browserHistoryIdx > 0) {
    _browserHistoryIdx--; const url = _browserHistory[_browserHistoryIdx]; _browserCurrentUrl = url;
    document.getElementById('browser-url-input').value = url;
    _updateNavBtns();

    if (window.electronAPI && window.electronAPI.isElectron && window.electronAPI.isElectron()) {
      window.electronAPI.browserBack().catch(() => {});
    } else {
      document.getElementById('browser-iframe').src = `/api/proxy?url=${encodeURIComponent(url)}`;
    }
  }
}

function browserForward() {
  if (_browserHistoryIdx < _browserHistory.length - 1) {
    _browserHistoryIdx++; const url = _browserHistory[_browserHistoryIdx]; _browserCurrentUrl = url;
    document.getElementById('browser-url-input').value = url;
    _updateNavBtns();

    if (window.electronAPI && window.electronAPI.isElectron && window.electronAPI.isElectron()) {
      window.electronAPI.browserForward().catch(() => {});
    } else {
      document.getElementById('browser-iframe').src = `/api/proxy?url=${encodeURIComponent(url)}`;
    }
  }
}

function browserReload() {
  const bar = document.getElementById('browser-loading-bar');
  if (bar) bar.style.display = 'block';

  if (window.electronAPI && window.electronAPI.isElectron && window.electronAPI.isElectron()) {
    window.electronAPI.browserReload().catch(() => {});
  } else {
    const iframe = document.getElementById('browser-iframe');
    if (iframe && _browserCurrentUrl) {
      iframe.src = `/api/proxy?url=${encodeURIComponent(_browserCurrentUrl)}`;
    }
  }
}

function browserOpenTab() {
  if (!_browserCurrentUrl) return;
  if (window.electronAPI && window.electronAPI.isElectron && window.electronAPI.isElectron()) {
    window.electronAPI.browserNavigate(_browserCurrentUrl).catch(() => { window.open(_browserCurrentUrl, '_blank', 'noopener,noreferrer'); });
  } else {
    window.open(_browserCurrentUrl, '_blank', 'noopener,noreferrer');
  }
}

function browserShowHome() {
  document.getElementById('browser-home').style.display = 'flex';
  document.getElementById('browser-iframe-area').style.display = 'none';
  document.getElementById('browser-url-input').value = '';
  _browserCurrentUrl = '';
  _renderSearchHistory();
}

function focusBrowserSearch() { document.getElementById('browser-url-input').focus(); }
function clearBrowserUrl() { document.getElementById('browser-url-input').value = ''; document.getElementById('browser-url-input').focus(); }

function _updateNavBtns() {
  const back = document.getElementById('browser-back-btn');
  const fwd = document.getElementById('browser-fwd-btn');
  if (back) back.disabled = _browserHistoryIdx <= 0;
  if (fwd) fwd.disabled = _browserHistoryIdx >= _browserHistory.length - 1;
}

function _addToSearchHistory(query) {
  _browserSearchHistory = [query, ..._browserSearchHistory.filter(q => q !== query)].slice(0, 10);
  try { localStorage.setItem('vavh_search_history', JSON.stringify(_browserSearchHistory)); } catch (e) { }
  _renderSearchHistory();
}

function _removeFromHistory(query) {
  _browserSearchHistory = _browserSearchHistory.filter(q => q !== query);
  try { localStorage.setItem('vavh_search_history', JSON.stringify(_browserSearchHistory)); } catch (e) { }
  _renderSearchHistory();
}

function _renderSearchHistory() {
  const wrap = document.getElementById('browser-history-wrap');
  const chips = document.getElementById('browser-history-chips');
  if (!wrap || !chips) return;
  if (!_browserSearchHistory.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  chips.replaceChildren();
  _browserSearchHistory.forEach((query) => {
    const chip = document.createElement('div');
    chip.className = 'search-chip';
    const value = document.createElement('span');
    value.textContent = query;
    value.addEventListener('click', () => browserNavigate(query));
    const remove = document.createElement('span');
    remove.className = 'chip-del';
    remove.textContent = '×';
    remove.addEventListener('click', () => _removeFromHistory(query));
    chip.append(value, remove);
    chips.appendChild(chip);
  });
}

function _initBrowserPage() {
  document.querySelectorAll('[data-browser-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.add('active');
      browserShowHome();
    });
  });

  document.querySelectorAll('[data-browser-search]').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = 'https://www.' + btn.dataset.browserSearch;
      browserGo(url);
    });
  });

  const homeEngine = document.getElementById('browser-home-engine');
  const topEngine = document.getElementById('browser-engine-pick');
  if (homeEngine && topEngine) {
    homeEngine.addEventListener('change', () => { topEngine.value = homeEngine.value; });
    topEngine.addEventListener('change', () => { homeEngine.value = topEngine.value; });
  }

  browserShowHome();
  document.getElementById('browser-home-search')?.focus();
}

document.addEventListener('DOMContentLoaded', _initBrowserPage);
