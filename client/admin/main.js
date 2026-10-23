/* =====================================================================
   SHARED CONSTANTS
   ===================================================================== */
const MGMT_KEY = 'vavh_studio_v3';   // management module localStorage prefix
const AUTH_KEY = 'vavh_unified_users';    // shared users store
const SESS_KEY = 'vavh_unified_session';  // shared session store

let currentUser = null;     // currently logged-in user object
let currentEditId = null;   // management module: id of item being edited
let currentChatId = null;   // management module: active chat id
let currentModule = 'mgmt'; // 'mgmt' | 'finance'
let currentFinPage = 'dashboard'; // active finance page
let currentMgmtTab = 'home'; // tracks active management tab across module switches

/* =====================================================================
   SHARED UTILITIES — merged best implementations from both files
   ===================================================================== */
const Utils = {
  /* ── LocalStorage ── */
  lsGet(k) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : []; } catch { return []; } },
  lsSet(k, d) { try { localStorage.setItem(k, JSON.stringify(d)); } catch (e) { console.warn('lsSet error', e); } },

  /* ── Management data helpers ── */
  getData(key) { return Utils.lsGet(`${MGMT_KEY}_${key}`); },
  saveData(key, d) { localStorage.setItem(`${MGMT_KEY}_${key}`, JSON.stringify(d)); },

  /* ── ID generation ── */
  uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2); },
  today() { return new Date().toISOString().split('T')[0]; },

  /* ── Formatting ── */
  formatCurrency(n) {
    const v = parseFloat(n) || 0;
    return 'BDT ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  },
  truncate(s, l = 30) { const t = String(s || ''); return t.length > l ? t.slice(0, l) + '…' : t; },
  sumBy(arr, k) { return arr.reduce((a, i) => a + (parseFloat(i[k]) || 0), 0); },

  /* ── HTML escape (XSS prevention) ── */
  esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  },
  safeId(value) {
    const id = String(value ?? '');
    return /^[A-Za-z0-9_-]+$/.test(id) ? id : '';
  },
  safeHttpUrl(value) {
    try {
      const url = new URL(String(value || ''), window.location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  },

  /* ── Sorting ── */
  sortTable(data, key, dir) {
    return [...data].sort((a, b) => {
      let va = a[key], vb = b[key];
      if (!isNaN(parseFloat(va)) && !isNaN(parseFloat(vb))) { va = parseFloat(va); vb = parseFloat(vb); }
      else { va = String(va || '').toLowerCase(); vb = String(vb || '').toLowerCase(); }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  },

  /* ── Badge helpers ── */
  platformBadge(p) {
    return ({ Facebook: 'badge-blue', Google: 'badge-red', TikTok: 'badge-gray', YouTube: 'badge-red', Instagram: 'badge-purple', Twitter: 'badge-cyan', LinkedIn: 'badge-blue' })[p] || 'badge-gray';
  },
  paymentBadge(m) {
    return ({ Cash: 'badge-green', Bank: 'badge-blue', 'Mobile Banking': 'badge-purple' })[m] || 'badge-gray';
  },

  /* ── Confirm delete ── */
  confirmDelete(n) { return confirm(`Delete "${n}"? This cannot be undone.`); },
};

/* ── Finance modal helpers (namespaced to avoid clashing with mgmt) ── */
const FU = {
  openModal(id) { const e = document.getElementById(id); if (e) { e.classList.add('open'); document.body.style.overflow = 'hidden'; } },
  closeModal(id) { const e = document.getElementById(id); if (e) { e.classList.remove('open'); document.body.style.overflow = ''; } },

  toast(msg, type = 'info') {
    const c = document.querySelector('.toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span><span>${Utils.esc(msg)}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 250); }, 3000);
  }
};

/* ── Management toast ── */
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast-mgmt');
  toast.innerText = msg;
  toast.style.background = isError ? '#ff6b6b' : '#4caf50';
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2800);
}

/* =====================================================================
   AUTHENTICATION — unified user store for both modules
   ===================================================================== */
const Auth = {
  /* Default admin credentials are intentionally not created in the browser.
     Authentication and authorization must be handled by the backend and DB.
     This avoids a bypass path that can be exploited even when the UI is loaded. */
  initDefaults() {
    // no-op: do not seed or auto-login an admin account from the frontend
    return;
  },

  getUsers() { return []; },
  saveUsers() { return; },

  getCurrentUser() {
    try { const r = sessionStorage.getItem(SESS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  },
  setSession(user) { sessionStorage.setItem(SESS_KEY, JSON.stringify(user)); },
  clearSession() { sessionStorage.removeItem(SESS_KEY); },

  login() {
    const idRaw = document.getElementById('login-identifier').value.trim();
    const id = idRaw.toLowerCase(); // normalise — usernames/emails are stored lowercase
    const pwd = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    err.classList.remove('show');

    if (!idRaw || !pwd) {
      err.textContent = 'Please enter your credentials.';
      err.classList.add('show');
      return;
    }

    err.textContent = 'Authentication is handled by the server. Please use the server login form.';
    err.classList.add('show');
    document.getElementById('login-password').value = '';
    return;
  },

  logout() {
    if (!confirm('Sign out?')) return;
    this.clearSession();
    currentUser = null;
    document.getElementById('app-shell').style.display = 'none';
    document.getElementById('app-shell').classList.remove('visible');
  },

  onLoginSuccess(user) {
    const shell = document.getElementById('app-shell');
    shell.style.display = 'flex';
    shell.classList.add('visible');
    this.applyRolePermissions(user);
    this.updateSidebarUser(user);
    switchModule('mgmt');
    FU.toast('Welcome back, ' + user.name + '!', 'success');
  },

  checkSession() {
    this.initDefaults();
    const user = this.getCurrentUser();
    if (user) {
      currentUser = user;
      this.onLoginSuccess(user);
    }
  },

  applyRolePermissions(user) {
    const isAdmin = user.role === 'admin';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
    if (!isAdmin) {
      // Hide delete buttons in finance module
      setTimeout(() => {
        document.querySelectorAll('#module-finance .btn-del.btn-icon').forEach(el => el.style.display = 'none');
      }, 100);
    }
  },

  updateSidebarUser(user) {
    const avatarEl = document.getElementById('sidebar-avatar');
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    if (avatarEl) {
      const avatar = typeof user.avatar === 'string' && /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(user.avatar)
        ? user.avatar
        : '';
      if (avatar) {
        avatarEl.replaceChildren();
        const image = document.createElement('img');
        image.alt = '';
        image.src = avatar;
        avatarEl.appendChild(image);
      } else {
        avatarEl.textContent = (user.name || user.username || '?')[0].toUpperCase();
      }
    }
    if (nameEl) nameEl.textContent = user.name || user.username;
    if (roleEl) roleEl.textContent = user.designation || (user.role === 'admin' ? 'Administrator' : 'User');
  }
};

/* =====================================================================
   MODULE / NAVIGATION SWITCHING
   ===================================================================== */

/* ── Indicator bar helper ────────────────────────────────────────────────
   Uses a real <span> instead of ::before so it always repaints correctly
   when the parent <nav> is toggled between display:none and display:block.
   ──────────────────────────────────────────────────────────────────── */
function setNavActive(navSelector, itemSelector) {
  // Remove active + indicator from every item in this nav
  document.querySelectorAll(navSelector + ' .nav-item').forEach(el => {
    el.classList.remove('active');
    const existing = el.querySelector('.nav-indicator');
    if (existing) existing.remove();
  });
  if (!itemSelector) return;

  const target = document.querySelector(itemSelector);
  if (!target) return;

  // Force the browser to flush any pending layout/paint before we inject.
  // Reading offsetHeight triggers a synchronous reflow — this guarantees the
  // parent nav is fully "visible" in the render tree before appendChild fires,
  // which fixes the file:// repaint bug on Chromium-based browsers.
  const nav = target.closest('nav') || document.querySelector(navSelector);
  if (nav) void nav.offsetHeight;

  target.classList.add('active');
  const bar = document.createElement('span');
  bar.className = 'nav-indicator';
  target.appendChild(bar);
}

function switchModule(mod) {
  currentModule = mod;

  // Update module tab buttons
  document.getElementById('tab-mgmt').classList.toggle('active', mod === 'mgmt');
  document.getElementById('tab-finance').classList.toggle('active', mod === 'finance');

  // Clear ALL indicator bars and active states from BOTH navs
  setNavActive('#nav-mgmt', null);
  setNavActive('#nav-finance', null);

  // Show correct nav (must happen BEFORE switchTab/finNavigate so indicator renders into visible DOM)
  document.getElementById('nav-mgmt').style.display = mod === 'mgmt' ? '' : 'none';
  document.getElementById('nav-finance').style.display = mod === 'finance' ? '' : 'none';

  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');
  sidebar.style.display = '';
  mainContent.style.marginLeft = 'var(--sidebar-width)';

  // Show correct module view
  document.getElementById('module-mgmt').classList.toggle('active', mod === 'mgmt');
  document.getElementById('module-finance').classList.toggle('active', mod === 'finance');

  // Defer active-setting to next animation frame so the browser commits
  // the display:none -> display:block change before we inject the indicator span.
  // This is the critical fix for file:// protocol where paint batching differs.
  requestAnimationFrame(() => {
    if (mod === 'mgmt') {
      switchTab(currentMgmtTab || 'home');
    } else if (mod === 'finance') {
      finNavigate(currentFinPage || 'dashboard');
    }
  });
}

/* ── Mobile sidebar toggle ── */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = sidebar.classList.toggle('open');
  overlay.classList.toggle('open', isOpen);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

/* =====================================================================
   MANAGEMENT MODULE — tab routing & rendering
   ===================================================================== */

/* Attach management nav click handlers — deferred to DOMContentLoaded */
function attachMgmtNavHandlers() {
  document.querySelectorAll('#nav-mgmt .nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  currentMgmtTab = tab; // persist so switching back from Finance restores the correct tab

  // Set active item + inject real indicator bar (avoids ::before repaint bug on file://)
  setNavActive('#nav-mgmt', `#nav-mgmt .nav-item[data-tab="${tab}"]`);

  const container = document.getElementById('mgmt-content');
  const title = document.getElementById('mgmt-page-title');

  // Clear search on tab change
  const searchEl = document.getElementById('mgmt-search');
  if (searchEl) searchEl.value = '';

  // Close mobile sidebar
  closeSidebar();

  if (tab === 'home') {
    title.innerText = 'Dashboard Overview';
    renderMgmtHome(container);
  } else if (tab === 'products') {
    title.innerText = 'Product List';
    renderTable(container, 'products', ['Image', 'SKU', 'Name', 'Category', 'Sell Price', 'Mfr. Price', 'Stock', 'Supplier'],
      `<button class="btn-primary-mgmt" onclick="openMgmtModal('product')">+ Add Product</button>`);
  } else if (tab === 'customers') {
    title.innerText = 'Customer Database';
    renderTable(container, 'customers', ['Name', 'Contact', 'Address'],
      `<button class="btn-primary-mgmt" onclick="openMgmtModal('customer')">+ Add Customer</button>`);
  } else if (tab === 'suppliers') {
    title.innerText = 'Supplier Network';
    renderTable(container, 'suppliers', ['Code', 'Company', 'Contact Person', 'Phone', 'Email', 'Website', 'Tax Number', 'Address'],
      `<button class="btn-primary-mgmt" onclick="openMgmtModal('supplier')">+ Add Supplier</button>`);
  } else if (tab === 'analytics') {
    title.innerText = 'Analytics Dashboard';
    renderAnalyticsDashboard(container);
  } else if (tab === 'vavh-ai') {
    title.innerText = 'VAVH AI';
    renderVavhAiDashboard(container);
  } else if (tab === 'orders') {
    title.innerText = 'Order Management';
    renderTable(container, 'orders', ['Order ID', 'Customer', 'Details', 'Total', 'Finance Due', 'Status'],
      `<button class="btn-primary-mgmt" onclick="openMgmtModal('order')">+ New Order</button>`);
  } else if (tab === 'sys-users') {
    if (currentUser && currentUser.role !== 'admin') return;
    title.innerText = 'System Users';
    renderSysUsersTable(container);
  } else if (tab === 'chat') {
    title.innerText = 'Messages & Chat';
    initializeChatData();
    renderChatView(container);
  }
}

/* ── Shared Dashboard Data ── single source of truth used by both Management & Finance dashboards */
function getSharedDashboardData() {
  const products = Utils.getData('products');
  const orders = Utils.getData('orders');
  const customers = Utils.getData('customers');
  const suppliers = Utils.getData('suppliers');
  const users = Auth.getUsers();
  const lowStock = products.filter(function (x) { return parseInt(x.stock) < 5; }).length;
  const completedOrders = orders.filter(function (o) { return o.status === 'Completed'; });
  const pendingOrders = orders.filter(function (o) { return o.status === 'Pending'; });
  const autoData = BalanceEngine.computeAuto();
  const tI = autoData.tI, tE = autoData.tE, tP = autoData.tP, tM = autoData.tM, tOR = autoData.tOR;
  const finalBalance = BalanceEngine.getCurrent();
  const invStats = Inventory.computeStats();
  const totalPaid = orders.reduce(function (s, o) { return s + (parseFloat(o.duePaid) || 0); }, 0);
  const totalDue = orders.reduce(function (s, o) { return s + (parseFloat(o.dueRemaining) || 0); }, 0);
  return {
    products, orders, customers, suppliers, users,
    lowStock, completedOrders, pendingOrders,
    tI, tE, tP, tM, tOR, finalBalance, invStats, totalPaid, totalDue
  };
}

/* ── Build pending orders HTML — avoids nested template literals ── */
function _buildPendingOrdersHTML(pendingOrders) {
  if (pendingOrders.length === 0) {
    return '<div style="text-align:center;padding:20px;color:var(--text-muted-dark);opacity:.5"><i class="fas fa-check-circle" style="font-size:2rem;display:block;margin-bottom:8px"></i>All orders fulfilled</div>';
  }
  return pendingOrders.slice(0, 5).map(function (o) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">' +
      '<div><div style="font-size:13px;font-weight:600">' + Utils.esc(o.id) + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted-dark)">' + Utils.esc(o.customerName) + ' · ' + Utils.esc(o.productName) + ' \xD7' + o.qty + '</div></div>' +
      '<span class="status-badge" style="background:rgba(255,193,7,0.2);color:#ffc107">BDT ' + o.total + '</span></div>';
  }).join('');
}

/* ── Dashboard home ── shared between Management & Finance */
async function renderAnalyticsDashboard(container, presetRange = '30') {
  container.innerHTML = `
    <div class="glass-panel" style="padding:20px; margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div>
          <h3 style="margin:0 0 6px; font-size:1.2rem; font-weight:700;">Business Analytics</h3>
          <p style="margin:0; color:var(--text-muted-dark);">Profit, sales, and customer click insights</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-sec btn-sm ${presetRange === '7' ? 'active' : ''}" onclick="renderAnalyticsDashboard(document.getElementById('mgmt-content'), '7')">7D</button>
          <button class="btn btn-sec btn-sm ${presetRange === '30' ? 'active' : ''}" onclick="renderAnalyticsDashboard(document.getElementById('mgmt-content'), '30')">30D</button>
          <button class="btn btn-sec btn-sm ${presetRange === '90' ? 'active' : ''}" onclick="renderAnalyticsDashboard(document.getElementById('mgmt-content'), '90')">90D</button>
          <button class="btn btn-sec btn-sm ${presetRange === 'all' ? 'active' : ''}" onclick="renderAnalyticsDashboard(document.getElementById('mgmt-content'), 'all')">All</button>
          <button class="btn-primary-mgmt" onclick="renderAnalyticsDashboard(document.getElementById('mgmt-content'), '${presetRange}')">Refresh</button>
        </div>
      </div>
    </div>
    <div id="analytics-loader" style="padding:20px; color:var(--text-muted-dark);">Loading analytics...</div>
  `;

  try {
    const range = presetRange || '30';
    const res = await API.get('/analytics/overview?range=' + range);
    const profitRes = await API.get('/analytics/profit-loss?range=' + range);
    const topProductsRes = await API.get('/analytics/top-products?range=' + range);
    const clicksRes = await API.get('/analytics/clicks');

    if (!res?.success || !profitRes?.success) {
      throw new Error('Analytics unavailable');
    }

    const data = res.data;
    const profit = profitRes.data;
    const topProducts = topProductsRes?.data || [];
    const topClicks = clicksRes?.data || [];

    const trendLabels = (data.trend || []).map(item => item.month || 'Period');
    const trendValues = (data.trend || []).map(item => Number(item.revenue || 0));

    const html = `
      <div class="mgmt-stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); margin-bottom:18px;">
        <div class="mgmt-stat-card">
          <div class="mgmt-stat-icon"><i class="fas fa-dollar-sign"></i></div>
          <div>
            <h3 style="font-size:1.6rem;font-weight:700;color:#22c55e">BDT ${Number(data.stats.revenue || 0).toLocaleString()}</h3>
            <p style="color:var(--text-muted-dark)">Total Revenue</p>
          </div>
        </div>
        <div class="mgmt-stat-card">
          <div class="mgmt-stat-icon" style="background:rgba(91,106,245,.2);color:#5b6af5"><i class="fas fa-chart-line"></i></div>
          <div>
            <h3 style="font-size:1.6rem;font-weight:700;color:#5b6af5">BDT ${Number(data.stats.profit || 0).toLocaleString()}</h3>
            <p style="color:var(--text-muted-dark)">Profit / Loss</p>
          </div>
        </div>
        <div class="mgmt-stat-card">
          <div class="mgmt-stat-icon" style="background:rgba(245,158,11,.2);color:#f59e0b"><i class="fas fa-shopping-cart"></i></div>
          <div>
            <h3 style="font-size:1.6rem;font-weight:700;color:#f59e0b">${Number(data.stats.orders || 0).toLocaleString()}</h3>
            <p style="color:var(--text-muted-dark)">Completed Orders</p>
          </div>
        </div>
        <div class="mgmt-stat-card">
          <div class="mgmt-stat-icon" style="background:rgba(168,85,247,.2);color:#a855f7"><i class="fas fa-box"></i></div>
          <div>
            <h3 style="font-size:1.6rem;font-weight:700;color:#a855f7">${Number(data.stats.productCount || 0).toLocaleString()}</h3>
            <p style="color:var(--text-muted-dark)">Products</p>
          </div>
        </div>
      </div>

      <div class="glass-panel" style="padding:18px; margin-bottom:18px;">
        <h4 style="margin:0 0 12px; color:var(--text-muted-dark); text-transform:uppercase; letter-spacing:0.05em;">Sales Trend</h4>
        <div style="height:260px;">
          <canvas id="analytics-sales-chart"></canvas>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:18px;">
        <div class="glass-panel" style="padding:18px;">
          <h4 style="margin:0 0 12px; color:var(--text-muted-dark); text-transform:uppercase; letter-spacing:0.05em;">Top Selling Products</h4>
          <table class="data-table">
            <thead><tr><th>Product</th><th>Sales</th><th>Revenue</th></tr></thead>
            <tbody>
              ${(topProducts.length ? topProducts : []).map(item => `
                <tr>
                  <td>${Utils.esc(item.name || 'Unknown product')}</td>
                  <td>${Number(item.sales || 0)}</td>
                  <td>BDT ${Number(item.revenue || 0).toLocaleString()}</td>
                </tr>
              `).join('') || '<tr><td colspan="3" style="padding:18px; color:var(--text-muted-dark); text-align:center;">No sales data yet.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="glass-panel" style="padding:18px;">
          <h4 style="margin:0 0 12px; color:var(--text-muted-dark); text-transform:uppercase; letter-spacing:0.05em;">Most Clicked Products</h4>
          <table class="data-table">
            <thead><tr><th>Product</th><th>Clicks</th></tr></thead>
            <tbody>
              ${(topClicks.length ? topClicks : []).map(item => `
                <tr>
                  <td>${Utils.esc(item.name || 'Unknown product')}</td>
                  <td>${Number(item.clicks || 0)}</td>
                </tr>
              `).join('') || '<tr><td colspan="2" style="padding:18px; color:var(--text-muted-dark); text-align:center;">No click data yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1.1fr 0.9fr; gap:16px; margin-bottom:18px;">
        <div class="glass-panel" style="padding:18px;">
          <h4 style="margin:0 0 12px; color:var(--text-muted-dark); text-transform:uppercase; letter-spacing:0.05em;">Profit & Loss</h4>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div><strong>Revenue:</strong> BDT ${Number(profit.revenue || 0).toLocaleString()}</div>
            <div><strong>Costs:</strong> BDT ${Number(profit.cost || 0).toLocaleString()}</div>
            <div><strong>Profit / Loss:</strong> <span style="color:${(profit.profit || 0) >= 0 ? '#22c55e' : '#ef4444'}; font-weight:700;">BDT ${Number(profit.profit || 0).toLocaleString()}</span></div>
            <div><strong>Margin:</strong> ${(Number(profit.margin || 0)).toFixed(2)}%</div>
          </div>
        </div>

        <div class="glass-panel" style="padding:18px;">
          <h4 style="margin:0 0 12px; color:var(--text-muted-dark); text-transform:uppercase; letter-spacing:0.05em;">AI Insights</h4>
          <ul style="margin:0; padding-left:18px; color:var(--text-muted-dark); line-height:1.8;">
            ${(data.insights || []).map(item => `<li>${Utils.esc(item)}</li>`).join('') || '<li>No insights available yet.</li>'}
          </ul>
        </div>
      </div>
    `;

    container.innerHTML = html;

    if (window.Chart && trendLabels.length) {
      const canvas = document.getElementById('analytics-sales-chart');
      if (canvas) {
        new Chart(canvas, {
          type: 'line',
          data: {
            labels: trendLabels,
            datasets: [{
              label: 'Revenue',
              data: trendValues,
              borderColor: '#5b6af5',
              backgroundColor: 'rgba(91, 106, 245, 0.15)',
              fill: true,
              tension: 0.35,
              borderWidth: 2,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback(value) { return 'BDT ' + Number(value).toLocaleString(); }
                }
              }
            }
          }
        });
      }
    }
  } catch (err) {
    container.innerHTML = `
      <div class="glass-panel" style="padding:24px; color:var(--text-muted-dark);">
        <h3 style="margin:0 0 8px;">Analytics is not ready yet</h3>
        <p style="margin:0;">Please check the server and database connection. The analytics API may still need data.</p>
      </div>
    `;
    console.error('renderAnalyticsDashboard error:', err);
  }
}

function renderMgmtHome(container) {
  var d = getSharedDashboardData();
  var balColor = d.finalBalance >= 0 ? '#4caf50' : '#ff6b6b';
  var balRgb = d.finalBalance >= 0 ? '76,175,80' : '239,68,68';
  var lowStyle = d.lowStock > 0 ? 'border-color:#ff6b6b' : '';
  var lowIcStyle = d.lowStock > 0 ? 'color:#ff6b6b' : '';
  var tExp = (d.tE + d.tP + d.tM);

  container.innerHTML =
    '<div style="margin-bottom:18px;">' +
    '<h2 style="font-size:1rem;font-weight:600;color:var(--text-muted-dark);margin-bottom:14px;letter-spacing:0.05em;text-transform:uppercase;">' +
    '<i class="fas fa-tachometer-alt" style="margin-right:8px;color:var(--accent-green)"></i>Unified Overview \u2014 Management &amp; Finance</h2>' +
    '<div class="mgmt-stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">' +
    '<div class="mgmt-stat-card"><div class="mgmt-stat-icon"><i class="fas fa-box"></i></div><div><h3 style="font-size:1.6rem;font-weight:700">' + d.products.length + '</h3><p style="color:var(--text-muted-dark)">Total Products</p></div></div>' +
    '<div class="mgmt-stat-card"><div class="mgmt-stat-icon"><i class="fas fa-shopping-cart"></i></div><div><h3 style="font-size:1.6rem;font-weight:700">' + d.orders.length + '</h3><p style="color:var(--text-muted-dark)">Total Orders <span style="font-size:.75rem;opacity:.7">(' + d.completedOrders.length + ' done)</span></p></div></div>' +
    '<div class="mgmt-stat-card"><div class="mgmt-stat-icon"><i class="fas fa-users"></i></div><div><h3 style="font-size:1.6rem;font-weight:700">' + d.customers.length + '</h3><p style="color:var(--text-muted-dark)">Customers</p></div></div>' +
    '<div class="mgmt-stat-card" style="' + lowStyle + '"><div class="mgmt-stat-icon" style="' + lowIcStyle + '"><i class="fas fa-exclamation-triangle"></i></div><div><h3 style="font-size:1.6rem;font-weight:700">' + d.lowStock + '</h3><p style="color:var(--text-muted-dark)">Low Stock Alerts</p></div></div>' +
    '<div class="mgmt-stat-card"><div class="mgmt-stat-icon" style="background:rgba(91,106,245,.2);color:#5b6af5"><i class="fas fa-briefcase"></i></div><div><h3 style="font-size:1.6rem;font-weight:700;color:#5b6af5">BDT ' + (d.tI / 1000).toFixed(1) + 'K</h3><p style="color:var(--text-muted-dark)">Total Investment</p></div></div>' +
    '<div class="mgmt-stat-card"><div class="mgmt-stat-icon" style="background:rgba(34,197,94,.2);color:#22c55e"><i class="fas fa-receipt"></i></div><div><h3 style="font-size:1.6rem;font-weight:700;color:#22c55e">BDT ' + (d.tOR / 1000).toFixed(1) + 'K</h3><p style="color:var(--text-muted-dark)">Order Revenue</p></div></div>' +
    '<div class="mgmt-stat-card"><div class="mgmt-stat-icon" style="background:rgba(239,68,68,.2);color:#ef4444"><i class="fas fa-file-invoice-dollar"></i></div><div><h3 style="font-size:1.6rem;font-weight:700;color:#ef4444">BDT ' + (tExp / 1000).toFixed(1) + 'K</h3><p style="color:var(--text-muted-dark)">Total Expenses</p></div></div>' +
    '<div class="mgmt-stat-card"><div class="mgmt-stat-icon" style="background:rgba(' + balRgb + ',.2);color:' + balColor + '"><i class="fas fa-wallet"></i></div><div><h3 style="font-size:1.6rem;font-weight:700;color:' + balColor + '">BDT ' + (Math.abs(d.finalBalance) / 1000).toFixed(1) + 'K</h3><p style="color:var(--text-muted-dark)">Current Balance</p></div></div>' +
    '</div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">' +
    '<div class="glass-panel" style="padding:18px;">' +
    '<h4 style="color:var(--text-muted-dark);margin-bottom:12px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;"><i class="fas fa-industry" style="margin-right:6px;color:var(--accent-green)"></i>Inventory Snapshot</h4>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
    '<div style="background:rgba(76,175,80,.1);border-radius:10px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:var(--accent-green)">' + d.invStats.totalManufactured + '</div><div style="font-size:11px;color:var(--text-muted-dark)">Manufactured</div></div>' +
    '<div style="background:rgba(239,68,68,.1);border-radius:10px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:#ef4444">' + d.invStats.totalSold + '</div><div style="font-size:11px;color:var(--text-muted-dark)">Sold</div></div>' +
    '<div style="background:rgba(91,106,245,.1);border-radius:10px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:#5b6af5">' + d.invStats.totalStock + '</div><div style="font-size:11px;color:var(--text-muted-dark)">In Stock</div></div>' +
    '<div style="background:rgba(245,158,11,.1);border-radius:10px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:#f59e0b">' + d.totalDue.toFixed(0) + '</div><div style="font-size:11px;color:var(--text-muted-dark)">BDT Due</div></div>' +
    '</div>' +
    '</div>' +
    '<div class="glass-panel" style="padding:18px;">' +
    '<h4 style="color:var(--text-muted-dark);margin-bottom:12px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;"><i class="fas fa-clock" style="margin-right:6px;color:var(--accent-green)"></i>Pending Orders</h4>' +
    _buildPendingOrdersHTML(d.pendingOrders) +
    '</div>' +
    '</div>' +
    '<div class="glass-panel" style="padding:18px;text-align:center;">' +
    '<h2 style="margin-bottom:6px;">Welcome back, ' + Utils.esc(currentUser.name) + ' \uD83D\uDC4B</h2>' +
    '<p style="color:var(--text-muted-dark)">V.A.V.H Studio Management \u2014 <strong>' + d.users.length + '</strong> users \xB7 <strong>' + d.suppliers.length + '</strong> suppliers \xB7 Switch to Finance tab for detailed reporting.</p>' +
    '</div>';
}

/* ── System Users table — reads from unified Auth store ── */
function renderSysUsersTable(container) {
  const users = Auth.getUsers();
  let html = `<div class="glass-panel" style="padding:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3 style="font-size:1rem;font-weight:600;">System Users</h3>
      <div style="display:flex;gap:10px;">
        <button class="btn-primary-mgmt" onclick="openMgmtModal('user')">+ Create User</button>
        <button class="btn-export-mgmt" onclick="exportUsersCSV()"><i class="fas fa-download"></i> Export CSV</button>
      </div>
    </div>
    <div style="overflow-x:auto;"><table class="data-table"><thead><tr>
      <th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Designation</th><th>Actions</th>
    </tr></thead><tbody>`;

  if (users.length === 0) {
    html += `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted-dark)">No users found.</td></tr>`;
  }
  users.forEach(u => {
    const isMe = currentUser && currentUser.id === u.id;
    const roleColor = u.role === 'admin' ? '#ffc107' : '#aecbb5';
    html += `<tr>
      <td><strong>${Utils.esc(u.name)}</strong>${isMe ? ' <span style="font-size:10px;background:rgba(76,175,80,0.3);color:#4caf50;padding:1px 6px;border-radius:8px;">You</span>' : ''}</td>
      <td style="color:var(--text-muted-dark)">@${Utils.esc(u.username)}</td>
      <td style="color:var(--text-muted-dark)">${Utils.esc(u.email || '—')}</td>
      <td><span class="status-badge" style="color:${roleColor};background:${u.role === 'admin' ? 'rgba(255,193,7,0.2)' : 'rgba(174,203,181,0.2)'}">${Utils.esc(u.role)}</span></td>
      <td>${Utils.esc(u.designation || u.notes || '—')}</td>
      <td>
        <button class="action-btn edit-btn" onclick="openMgmtModal('user','${u.id}')"><i class="fas fa-edit"></i></button>
        ${!isMe ? `<button class="action-btn delete-btn" onclick="deleteItem('users','${u.id}')"><i class="fas fa-trash"></i></button>` : ''}
      </td>
    </tr>`;
  });

  html += `</tbody></table></div></div>`;
  container.innerHTML = html;
}

/* ── Export users CSV ── */
function exportUsersCSV() {
  const users = Auth.getUsers();
  if (!users.length) { showToast('No users to export!', true); return; }
  const keys = ['name', 'username', 'email', 'role', 'designation', 'createdAt'];
  let csv = keys.join(',') + '\n';
  users.forEach(u => { csv += keys.map(k => `"${String(u[k] || '').replace(/"/g, '""')}"`).join(',') + '\n'; });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `users_${Utils.today()}.csv`; a.click();
  URL.revokeObjectURL(url); showToast('Users exported!');
}

/* ── Generic table renderer ── */
function renderTable(container, type, cols, actionBtn) {
  const data = Utils.getData(type);
  let html = `<div class="glass-panel" style="padding:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3 style="font-size:1rem;font-weight:600;">${type.charAt(0).toUpperCase() + type.slice(1)}</h3>
      <div style="display:flex;gap:10px;">
        ${actionBtn}
        <button class="btn-export-mgmt" onclick="exportToCSV('${type}')"><i class="fas fa-download"></i> Export CSV</button>
      </div>
    </div>
    <div style="overflow-x:auto;"><table class="data-table"><thead><tr>`;

  cols.forEach(c => html += `<th>${c}</th>`);
  html += `<th>Actions</th></tr></thead><tbody>`;

  if (data.length === 0) {
    html += `<tr><td colspan="${cols.length + 1}" style="text-align:center;padding:30px;color:var(--text-muted-dark)">No records found.</td></tr>`;
  }

  data.forEach(item => {
    html += `<tr>`;
    if (type === 'products') {
      const imageSrc = item.image ? Utils.esc(item.image) : '';
      html += `<td style="width:74px;min-width:74px;text-align:center;"><div style="width:56px;height:56px;margin:0 auto;border-radius:12px;overflow:hidden;background:#111;display:flex;align-items:center;justify-content:center;">
          ${imageSrc ? `<img src="${imageSrc}" alt="${Utils.esc(item.name || 'Product')}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />` : '<span style="font-size:10px;color:#8b8b8b;">No image</span>'}
        </div></td>`;
      html += `<td>${Utils.esc(item.sku)}</td><td>${Utils.esc(item.name)}</td><td>${Utils.esc(item.category)}</td><td>BDT ${item.price}</td>
        <td>${item.manufacturerPrice ? '<span style="color:#b45309;font-weight:600;">BDT ' + item.manufacturerPrice + '</span>' : '<span style="color:#9ca3af;">—</span>'}</td>
        <td><span class="${parseInt(item.stock) < 5 ? 'status-badge alert-badge' : 'status-badge'}">${item.stock}</span></td><td>${Utils.esc(item.supplier || '—')}</td>`;
    } else if (type === 'customers') {
      html += `<td>${Utils.esc(item.name)}</td><td>${Utils.esc(item.contact)}</td><td>${Utils.esc(item.address)}</td>`;
    } else if (type === 'suppliers') {
      const website = Utils.safeHttpUrl(item.website);
      html += `<td>${Utils.esc(item.supplierCode || '')}</td><td><strong>${Utils.esc(item.company)}</strong></td><td>${Utils.esc(item.name)}</td><td>${Utils.esc(item.number)}</td><td>${Utils.esc(item.email || '')}</td><td>${website ? `<a href="${Utils.esc(website)}" target="_blank" rel="noreferrer">${Utils.esc(website)}</a>` : '—'}</td><td>${Utils.esc(item.tax_number || '')}</td><td>${Utils.esc(Utils.truncate(item.address || '', 30))}</td>`;
    } else if (type === 'orders') {
      const statusColor = item.status === 'Pending' ? '#ffc107' : item.status === 'Completed' ? '#4caf50' : '#ff6b6b';
      const statusBg = item.status === 'Pending' ? 'rgba(255,193,7,0.3)' : item.status === 'Completed' ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)';
      const finDue = item.financeNameDue || '—';
      const finColor = finDue.includes('Customer will pay') ? '#155e75' : finDue.includes('Dealer will pay') ? '#92400e' : finDue.includes('pay customer') ? '#991b1b' : finDue.includes('pay dealer') ? '#166534' : '#6b7280';
      const finBg = finDue.includes('Customer will pay') ? 'rgba(6,182,212,0.15)' : finDue.includes('Dealer will pay') ? 'rgba(245,158,11,0.15)' : finDue.includes('pay customer') ? 'rgba(239,68,68,0.15)' : finDue.includes('pay dealer') ? 'rgba(34,197,94,0.15)' : 'transparent';
      html += `<td>${Utils.esc(item.id)}</td><td>${Utils.esc(item.customerName)}</td><td>${Utils.esc(item.productName)} (x${item.qty})</td><td>BDT ${item.total}</td>
        <td><span style="background:${finBg};color:${finColor};padding:3px 9px;border-radius:12px;font-size:12px;font-weight:500;white-space:nowrap;">${Utils.esc(finDue)}</span></td>
        <td><span class="status-badge" style="background:${statusBg};color:${statusColor}">${Utils.esc(item.status)}</span></td>`;
    } else if (type === 'users') {
      html += `<td>${Utils.esc(item.name)}</td><td>${Utils.esc(item.email)}</td><td>${Utils.esc(item.role)}</td><td>${Utils.esc(item.designation || '—')}</td>`;
    }
    const typeKey = type === 'products' ? 'product' : type === 'users' ? 'user' : type.slice(0, -1);
    html += `<td>
      <button class="action-btn edit-btn" onclick="openMgmtModal('${typeKey}', '${item.id}')"><i class="fas fa-edit"></i></button>
      <button class="action-btn delete-btn" onclick="deleteItem('${type}', '${item.id}')"><i class="fas fa-trash"></i></button>
    </td></tr>`;
  });

  html += `</tbody></table></div></div>`;
  container.innerHTML = html;
}

/* =====================================================================
   MANAGEMENT CRUD MODALS
   ===================================================================== */
function openMgmtModal(type, id = null) {
  currentEditId = id;
  const overlay = document.getElementById('mgmt-modal-overlay');
  const modal = document.getElementById('mgmt-generic-modal');
  const profile = document.getElementById('mgmt-profile-modal');
  const chatMod = document.getElementById('mgmt-chat-modal');
  overlay.classList.remove('hidden');
  modal.classList.remove('hidden');
  profile.classList.add('hidden');
  chatMod.classList.add('hidden');

  const body = document.getElementById('mgmt-modal-body');
  const title = document.getElementById('mgmt-modal-title');
  let data = {};
  if (id) data = Utils.getData(type === 'product' ? 'products' : type === 'order' ? 'orders' : type + 's').find(i => i.id === id) || {};
  // Users live in the unified Auth store, not the management prefix store
  if (type === 'user' && id) data = Auth.getUsers().find(i => i.id === id) || {};

  if (type === 'product') {
    title.innerText = id ? 'Edit Product' : 'New Product';
    const suppliers = Utils.getData('suppliers').map(s => `<option value="${Utils.esc(s.company)}">${Utils.esc(s.company)}</option>`).join('');
    
    // Get all unique categories from existing products
    const allProducts = Utils.getData('products') || [];
    const existingCategories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
    const categoryOptions = existingCategories.map(cat => `<option value="${Utils.esc(cat)}">${Utils.esc(cat)}</option>`).join('');
    
    body.innerHTML = `
      <form onsubmit="handleFormSubmit(event, 'products')">
        <div class="form-grid">
          <div><label class="form-label-mgmt">Name *</label><input type="text" name="name" class="form-input-mgmt" value="${Utils.esc(data.name || '')}" required></div>
          <div><label class="form-label-mgmt">Product ID</label><input type="text" name="productId" class="form-input-mgmt" value="${Utils.esc(data.productId || '')}" placeholder="Internal product identifier"></div>
          <div><label class="form-label-mgmt">SKU *</label><input type="text" name="sku" class="form-input-mgmt" value="${Utils.esc(data.sku || '')}" required></div>
          <div><label class="form-label-mgmt">Category *</label><div style="display:flex;gap:8px;align-items:center;">
            <select name="category" class="form-input-mgmt" id="productCategorySelect" style="flex:1;" required onchange="handleCategoryChange()">
              <option value="">Select or type new</option>
              ${categoryOptions}
            </select>
            <button type="button" class="btn-primary-mgmt" onclick="openAddCategoryModal()" title="Create new category" style="padding:8px 12px;white-space:nowrap;flex-shrink:0;"><i class="fas fa-plus"></i> New</button>
          </div></div>
          <div><label class="form-label-mgmt">Upload Image</label><input type="file" name="imageFile" accept="image/*" class="form-input-mgmt" onchange="previewProductImage(event)"></div>
          <input type="hidden" name="image" id="mgmt-product-image-value" value="${Utils.esc(data.image || '')}">
          <div style="width:100%;display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;">
            <div style="min-width:90px;max-width:140px;">
              <label class="form-label-mgmt">Preview</label>
              <img id="mgmt-product-image-preview" src="${Utils.esc(data.image || '')}" alt="Product image" style="width:100%;height:100px;object-fit:cover;border-radius:12px;background:#111;${data.image ? '' : 'display:none;'}" onerror="this.style.display='none'" />
            </div>
            <div style="flex:1;min-width:180px;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.72);">Choose an image file for this product. The image will display in the product list.</p>
            </div>
          </div>
          <div><label class="form-label-mgmt">Selling Price (BDT) *</label><input type="number" step="0.01" name="price" class="form-input-mgmt" value="${data.price || ''}" placeholder="Price customer pays" required></div>
          <div><label class="form-label-mgmt">Manufacturer Price (BDT)</label><input type="number" step="0.01" name="manufacturerPrice" class="form-input-mgmt" value="${data.manufacturerPrice || ''}" placeholder="Your cost from supplier"><div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:3px;">🔗 Auto-syncs to Finance → Product Expenses</div></div>
          <div><label class="form-label-mgmt">Stock *</label><input type="number" name="stock" class="form-input-mgmt" value="${data.stock || ''}" required></div>
          <div><label class="form-label-mgmt">Color</label><select name="color" class="form-input-mgmt"><option value="">Select</option><option value="Red" ${data.color === 'Red' ? 'selected' : ''}>Red</option><option value="Green" ${data.color === 'Green' ? 'selected' : ''}>Green</option><option value="Blue" ${data.color === 'Blue' ? 'selected' : ''}>Blue</option><option value="Black" ${data.color === 'Black' ? 'selected' : ''}>Black</option><option value="White" ${data.color === 'White' ? 'selected' : ''}>White</option><option value="Multicolor" ${data.color === 'Multicolor' ? 'selected' : ''}>Multicolor</option><option value="Other" ${data.color === 'Other' ? 'selected' : ''}>Other</option></select></div>
          <div><label class="form-label-mgmt">Height (cm/inch/ft)</label><input type="number" step="0.01" name="height" class="form-input-mgmt" value="${data.height || ''}" placeholder="Height"></div>
          <div><label class="form-label-mgmt">Width (cm/inch/ft)</label><input type="number" step="0.01" name="width" class="form-input-mgmt" value="${data.width || ''}" placeholder="Width"></div>
          <div><label class="form-label-mgmt">Length (cm/inch/ft)</label><input type="number" step="0.01" name="length" class="form-input-mgmt" value="${data.length || ''}" placeholder="Length"></div>
          <div><label class="form-label-mgmt">Weight (kg)</label><input type="number" step="0.01" name="weight" class="form-input-mgmt" value="${data.weight || ''}" placeholder="Weight"></div>
          <div><label class="form-label-mgmt">Supplier</label><select name="supplier" class="form-input-mgmt"><option value="">Select</option>${suppliers}</select></div>
        </div>
        <button class="btn-primary-mgmt" style="margin-top:16px;width:100%">${id ? 'Update Product' : 'Add Product'}</button>
      </form>`;
    
    if (data.category) {
      setTimeout(() => {
        const categorySelect = document.getElementById('productCategorySelect');
        if (categorySelect) categorySelect.value = data.category;
      }, 0);
    }
    
    if (data.supplier) {
      setTimeout(() => { 
        const sel = body.querySelector('select[name="supplier"]'); 
        if (sel) sel.value = data.supplier; 
      }, 0);
    }

  } else if (type === 'supplier') {
    title.innerText = id ? 'Edit Supplier' : 'New Supplier';
    body.innerHTML = `
      <form onsubmit="handleFormSubmit(event, 'suppliers')">
        <div class="form-grid">
          <div><label class="form-label-mgmt">Supplier Code</label><input type="text" name="supplierCode" class="form-input-mgmt" value="${Utils.esc(data.supplierCode || '')}" placeholder="Optional"></div>
          <div><label class="form-label-mgmt">Company *</label><input type="text" name="company" class="form-input-mgmt" value="${Utils.esc(data.company || '')}" required></div>
          <div><label class="form-label-mgmt">Contact Person *</label><input type="text" name="name" class="form-input-mgmt" value="${Utils.esc(data.name || '')}" required></div>
          <div><label class="form-label-mgmt">Designation</label><input type="text" name="designation" class="form-input-mgmt" value="${Utils.esc(data.designation || '')}"></div>
          <div><label class="form-label-mgmt">Phone *</label><input type="text" name="number" class="form-input-mgmt" value="${Utils.esc(data.number || '')}" required></div>
          <div><label class="form-label-mgmt">Email</label><input type="email" name="email" class="form-input-mgmt" value="${Utils.esc(data.email || '')}" placeholder="Optional"></div>
          <div><label class="form-label-mgmt">Website</label><input type="text" name="website" class="form-input-mgmt" value="${Utils.esc(data.website || '')}" placeholder="Optional"></div>
          <div><label class="form-label-mgmt">Tax Number</label><input type="text" name="tax_number" class="form-input-mgmt" value="${Utils.esc(data.tax_number || '')}" placeholder="Optional"></div>
          <div class="full-width"><label class="form-label-mgmt">Address</label><input type="text" name="address" class="form-input-mgmt" value="${Utils.esc(data.address || '')}"></div>
          <div class="full-width"><label class="form-label-mgmt">Comments</label><textarea name="comments" class="form-input-mgmt">${Utils.esc(data.comments || '')}</textarea></div>
        </div>
        <button class="btn-primary-mgmt" style="margin-top:16px;width:100%">${id ? 'Update Supplier' : 'Add Supplier'}</button>
      </form>`;
  } else if (type === 'customer') {
    title.innerText = id ? 'Edit Customer' : 'New Customer';
    body.innerHTML = `
      <form onsubmit="handleFormSubmit(event, 'customers')">
        <div class="form-grid">
          <div class="full-width"><label class="form-label-mgmt">Name *</label><input type="text" name="name" class="form-input-mgmt" value="${Utils.esc(data.name || '')}" required></div>
          <div class="full-width"><label class="form-label-mgmt">Phone *</label><input type="text" name="contact" class="form-input-mgmt" value="${Utils.esc(data.contact || '')}" required></div>
          <div class="full-width"><label class="form-label-mgmt">Address</label><textarea name="address" class="form-input-mgmt">${Utils.esc(data.address || '')}</textarea></div>
        </div>
        <button class="btn-primary-mgmt" style="margin-top:16px;width:100%">${id ? 'Update Customer' : 'Add Customer'}</button>
      </form>`;
  } else if (type === 'user') {
    title.innerText = id ? 'Edit User' : 'New User';
    body.innerHTML = `
      <form onsubmit="handleFormSubmit(event, 'users')">
        <div class="form-grid">
          <div><label class="form-label-mgmt">Full Name *</label><input type="text" name="name" class="form-input-mgmt" value="${Utils.esc(data.name || '')}" required></div>
          <div><label class="form-label-mgmt">Username *</label><input type="text" name="username" class="form-input-mgmt" value="${Utils.esc(data.username || '')}" required></div>
          <div><label class="form-label-mgmt">Email *</label><input type="email" name="email" class="form-input-mgmt" value="${Utils.esc(data.email || '')}" required></div>
          <div><label class="form-label-mgmt">Password ${id ? '(leave blank to keep current)' : '*'}</label><input type="password" name="password" class="form-input-mgmt" placeholder="${id ? 'Leave blank to keep current' : 'Enter password'}" ${id ? '' : 'required'}></div>
          <div><label class="form-label-mgmt">Role</label><select name="role" class="form-input-mgmt"><option value="user" ${data.role === 'user' ? 'selected' : ''}>User</option><option value="admin" ${data.role === 'admin' ? 'selected' : ''}>Admin</option></select></div>
          <div><label class="form-label-mgmt">Designation *</label><input type="text" name="designation" class="form-input-mgmt" value="${Utils.esc(data.designation || '')}" required></div>
        </div>
        <button class="btn-primary-mgmt" style="margin-top:16px;width:100%">${id ? 'Update User' : 'Create User'}</button>
      </form>`;
  } else if (type === 'order') {
    if (id) {
      // Edit: change status only
      title.innerText = 'Edit Order Status';
      body.innerHTML = `
        <form onsubmit="handleEditOrder(event,'${id}')">
          <div class="form-grid">
            <div class="full-width"><label class="form-label-mgmt">Order ID</label><input class="form-input-mgmt" value="${Utils.esc(data.id || '')}" disabled style="opacity:.6"></div>
            <div class="full-width"><label class="form-label-mgmt">Customer</label><input class="form-input-mgmt" value="${Utils.esc(data.customerName || '')}" disabled style="opacity:.6"></div>
            <div class="full-width"><label class="form-label-mgmt">Product</label><input class="form-input-mgmt" value="${Utils.esc(data.productName || '')} (x${data.qty || 1})" disabled style="opacity:.6"></div>
            <div class="full-width"><label class="form-label-mgmt">Total</label><input class="form-input-mgmt" value="BDT ${data.total || 0}" disabled style="opacity:.6"></div>
            <div class="full-width"><label class="form-label-mgmt">Status *</label>
              <select name="status" class="form-input-mgmt" required>
                <option value="Pending" ${data.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Completed" ${data.status === 'Completed' ? 'selected' : ''}>Completed</option>
                <option value="Cancelled" ${data.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </div>
          </div>
          <button class="btn-primary-mgmt" style="margin-top:16px;width:100%">Update Order Status</button>
        </form>`;
    } else {
      // New order
      const products = Utils.getData('products');
      const customers = Utils.getData('customers');
      const prodOpts = products.map(p => `<option value="${p.id}" data-n="${Utils.esc(p.name)}" data-p="${p.price}">${Utils.esc(p.name)} (${Utils.esc(p.sku)}) — BDT ${p.price}</option>`).join('');
      const custOpts = customers.map(c => `<option value="${Utils.esc(c.name)}">${Utils.esc(c.name)} (${Utils.esc(c.contact)})</option>`).join('');
      title.innerText = 'New Order';
      body.innerHTML = `
        <form onsubmit="handleOrderSubmit(event)">
          <div class="form-grid">
            <div class="full-width"><label class="form-label-mgmt">Product *</label><select id="ord-prod" name="productId" class="form-input-mgmt" required><option value="">Select Product</option>${prodOpts}</select></div>
            <div><label class="form-label-mgmt">Quantity *</label><input type="number" name="qty" id="ord-qty" class="form-input-mgmt" min="1" value="1" required oninput="updateOrderDueCalc()"></div>
            <div class="full-width"><label class="form-label-mgmt">Customer *</label>
              <div style="display:flex;gap:8px;">
                <select id="ord-cust" name="customer" class="form-input-mgmt" style="flex:1"><option value="">Select Customer</option>${custOpts}</select>
                <button type="button" class="btn-primary-mgmt" style="padding:8px 12px;white-space:nowrap;font-size:12px;" onclick="openCreateCustomerModal()">+ New</button>
              </div>
            </div>
          </div>

          <div style="border:1.5px solid rgba(76,175,80,0.35);border-radius:10px;padding:14px 16px;margin-top:4px;background:rgba(76,175,80,0.05);">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4caf50;margin-bottom:12px;"><i class="fas fa-hand-holding-usd" style="margin-right:6px;"></i>Finance / Due Details</div>
            <div class="form-grid">
              <div class="full-width">
                <label class="form-label-mgmt">Who handles payment?</label>
                <select name="financeNameDue" id="ord-finance-due" class="form-input-mgmt" onchange="updateOrderDueCalc()">
                  <option value="">— Select who handles finance —</option>
                  <option value="Customer will pay">💳 Customer will pay</option>
                  <option value="Dealer will pay">🏪 Dealer will pay</option>
                  <option value="I need to pay customer">💸 I need to pay customer</option>
                  <option value="I need to pay dealer">🤝 I need to pay dealer</option>
                </select>
              </div>
              <div>
                <label class="form-label-mgmt">Total Due Amount (BDT)</label>
                <input type="number" name="dueTotal" id="ord-due-total" class="form-input-mgmt" placeholder="Auto-filled or enter manually" step="0.01" min="0" oninput="updateOrderDueCalc()">
                <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:3px;">Auto-filled from product × qty</div>
              </div>
              <div>
                <label class="form-label-mgmt">Amount Already Paid (BDT)</label>
                <input type="number" name="duePaid" id="ord-due-paid" class="form-input-mgmt" placeholder="0.00" step="0.01" min="0" value="0" oninput="updateOrderDueCalc()">
              </div>
            </div>
            <div id="ord-due-summary" style="display:none;margin-top:10px;background:rgba(0,0,0,0.2);border-radius:8px;padding:10px 14px;display:flex;gap:20px;align-items:center;flex-wrap:wrap;">
              <div style="text-align:center;">
                <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em;">Total Due</div>
                <div id="ord-due-sum-total" style="font-size:16px;font-weight:700;color:#fff;">BDT 0.00</div>
              </div>
              <div style="font-size:18px;color:rgba(255,255,255,0.3);">−</div>
              <div style="text-align:center;">
                <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em;">Paid</div>
                <div id="ord-due-sum-paid" style="font-size:16px;font-weight:700;color:#4caf50;">BDT 0.00</div>
              </div>
              <div style="font-size:18px;color:rgba(255,255,255,0.3);">=</div>
              <div style="text-align:center;">
                <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em;">Remaining</div>
                <div id="ord-due-sum-remaining" style="font-size:16px;font-weight:700;color:#ffc107;">BDT 0.00</div>
              </div>
            </div>
          </div>

          <button class="btn-primary-mgmt" style="margin-top:16px;width:100%">Create Order</button>
        </form>`;
    }
  }
}

// ── Category management helpers ────────────────────────────

function handleCategoryChange() {
  const select = document.getElementById('productCategorySelect');
  const input = select?.value || '';
  if (input === '') {
    select?.focus();
  }
}

function openAddCategoryModal() {
  const currentValue = document.getElementById('productCategorySelect')?.value || '';
  const newCat = prompt('Enter new category name:', '');
  
  if (!newCat || newCat.trim() === '') {
    return;
  }
  
  const trimmedCat = newCat.trim();
  const select = document.getElementById('productCategorySelect');
  
  // Check if category already exists
  const options = Array.from(select.querySelectorAll('option')).map(o => o.value);
  if (options.includes(trimmedCat)) {
    alert(`Category "${trimmedCat}" already exists!`);
    select.value = trimmedCat;
    return;
  }
  
  // Add the new category option to the dropdown
  const newOption = document.createElement('option');
  newOption.value = trimmedCat;
  newOption.textContent = trimmedCat;
  select.appendChild(newOption);
  
  // Select the newly created category
  select.value = trimmedCat;
  
  showToast(`✨ Category "${trimmedCat}" added!`, false);
}

function closeMgmtModal() {
  document.getElementById('mgmt-modal-overlay').classList.add('hidden');
}

function openProfile() {
  if (!currentUser) return;
  const overlay = document.getElementById('mgmt-modal-overlay');
  overlay.classList.remove('hidden');
  document.getElementById('mgmt-generic-modal').classList.add('hidden');
  document.getElementById('mgmt-chat-modal').classList.add('hidden');
  document.getElementById('mgmt-profile-modal').classList.remove('hidden');
  document.getElementById('prof-name').value = currentUser.name || '';
  document.getElementById('prof-designation').value = currentUser.designation || currentUser.notes || '';
  document.getElementById('prof-pass').value = '';
  // Show existing avatar or a generated initials SVG as placeholder
  const avatarEl = document.getElementById('preview-avatar');
  if (currentUser.avatar && currentUser.avatar.startsWith('data:')) {
    avatarEl.src = currentUser.avatar;
  } else {
    const initials = (currentUser.name || 'U')[0].toUpperCase();
    avatarEl.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'><rect width='90' height='90' rx='45' fill='%234caf50'/><text x='45' y='58' text-anchor='middle' font-size='36' font-family='sans-serif' fill='white'>${initials}</text></svg>`;
  }
}

/* ── CRUD submit handler ── */
async function handleFormSubmit(e, type) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const newItem = Object.fromEntries(formData.entries());

  const imageFile = formData.get('imageFile');
  if (imageFile && imageFile.size) {
    newItem.image = await fileToDataUrl(imageFile);
  }
  delete newItem.imageFile;

  // Determine which tab to return to after save
  const tabAfter = { products: 'products', suppliers: 'suppliers', customers: 'customers', users: 'sys-users', orders: 'orders' };

  if (type === 'users') {
    // Users are stored in the unified Auth store
    const name = newItem.name?.trim();
    const username = newItem.username?.trim().toLowerCase();
    const password = newItem.password;
    const role = newItem.role || 'user';
    const desig = newItem.designation?.trim() || '';

    if (!name || !username) { showToast('Name and username are required!', true); return; }

    let users = Auth.getUsers();
    if (users.find(u => u.username === username && u.id !== currentEditId)) {
      showToast('Username already taken!', true); return;
    }

    try {
      let result;
      if (currentEditId) {
        // ✅ SYNC UPDATE TO DATABASE
        result = await API.put(`/users/${currentEditId}`, {
          name, username, role, designation: desig,
          ...(password ? { password } : {})
        });
        if (result?.success) {
          users = users.map(u => u.id !== currentEditId ? u : { ...u, name, username, role, designation: desig, notes: desig });
          Auth.saveUsers(users);
          currentEditId = null;
          closeMgmtModal();
          showToast('✓ User Updated');
        } else {
          showToast(result?.message || 'Failed to update user', true);
          return;
        }
      } else {
        if (!password || password.length < 4) { showToast('Password required (min 4 chars)!', true); return; }
        // ✅ SYNC CREATE TO DATABASE
        result = await API.post('/users', {
          name, username, password, role, designation: desig
        });
        if (result?.success) {
          users.push({ id: result.id, name, username, role, designation: desig, notes: desig, createdAt: new Date().toISOString() });
          Auth.saveUsers(users);
          closeMgmtModal();
          showToast('✓ User Created');
        } else {
          showToast(result?.message || 'Failed to create user', true);
          return;
        }
      }
    } catch (err) {
      console.error('User save error:', err);
      showToast('Error saving user', true);
      return;
    }
    setTimeout(() => switchTab('sys-users'), 200);
    return;
  }

  // All other types use the management-prefixed store
  let list = Utils.getData(type);

  try {
    if (currentEditId) {
      const idx = list.findIndex(i => i.id === currentEditId);
      if (idx > -1) {
        const updatedItem = { ...list[idx], ...newItem };

        // ✅ SYNC UPDATE TO DATABASE
        const result = await API.put(`/${type}/${currentEditId}`, newItem);
        if (result?.success) {
          list[idx] = updatedItem;
          Utils.saveData(type, list);
          currentEditId = null;
          closeMgmtModal();
          showToast('✓ Updated Successfully');
          if (type === 'suppliers') window.dispatchEvent(new CustomEvent('vavh-suppliers-updated'));
          if (type === 'products') syncManufacturerCostToProductExpenses(list[idx], 'update');
          setTimeout(() => switchTab(tabAfter[type] || 'home'), 200);
        } else {
          showToast(result?.message || 'Failed to update', true);
        }
      }
    } else {
      newItem.id = Utils.uid();

      // ✅ SYNC CREATE TO DATABASE
      const result = await API.post(`/${type}`, newItem);
      if (result?.success) {
        list.push(newItem);
        Utils.saveData(type, list);
        closeMgmtModal();
        showToast('✓ Created Successfully');
        if (type === 'suppliers') window.dispatchEvent(new CustomEvent('vavh-suppliers-updated'));
        if (type === 'products') syncManufacturerCostToProductExpenses(newItem, 'create');
        setTimeout(() => switchTab(tabAfter[type] || 'home'), 200);
      } else {
        showToast(result?.message || 'Failed to create', true);
      }
    }
  } catch (err) {
    console.error(`${type} save error:`, err);
    showToast(`Error saving ${type}`, true);
  }
}

/* ── Auto-sync Manufacturer Cost → Finance Product Expenses ──────────────
   When a product is created or updated in Management with a manufacturerPrice,
   this creates/updates a matching entry in Finance Product Expenses.
   The admin can then freely edit it in Finance → Product Expenses.
   ──────────────────────────────────────────────────────────────────────── */
function syncManufacturerCostToProductExpenses(product, action) {
  const mfrPrice = parseFloat(product.manufacturerPrice);
  if (!mfrPrice || mfrPrice <= 0) return; // nothing to sync

  const finProducts = Utils.lsGet('products'); // Finance product expenses
  // Check if we already have a synced entry for this management product
  const existingIdx = finProducts.findIndex(fp => fp._mgmtProductId === product.id);

  const syncedEntry = {
    _mgmtProductId: product.id,
    productName: product.name,
    itemName: 'Manufacturer / Production Cost',
    supplier: product.supplier || '',
    quantity: parseInt(product.stock) || 1,
    cost: mfrPrice,
    date: Utils.today()
  };

  if (existingIdx > -1 && action === 'update') {
    // Update existing synced entry (but preserve any admin edits by only updating core fields)
    finProducts[existingIdx] = {
      ...finProducts[existingIdx],
      productName: product.name,
      supplier: product.supplier || finProducts[existingIdx].supplier,
      cost: mfrPrice
    };
    Utils.lsSet('products', finProducts);
    showToast('📦 Manufacturer cost synced to Product Expenses.', false);
  } else if (existingIdx === -1) {
    // Create new synced entry
    syncedEntry.id = Utils.uid();
    finProducts.push(syncedEntry);
    Utils.lsSet('products', finProducts);
    showToast('📦 Manufacturer cost added to Product Expenses.', false);
  }
}

async function deleteItem(type, id) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  const tabAfter = { products: 'products', suppliers: 'suppliers', customers: 'customers', users: 'sys-users', orders: 'orders' };

  try {
    if (type === 'users') {
      // Prevent self-deletion
      if (currentUser && currentUser.id === id) { showToast('Cannot delete your own account!', true); return; }

      // ✅ SYNC DELETE TO DATABASE
      const result = await API.del(`/users/${id}`);
      if (result?.success) {
        Auth.saveUsers(Auth.getUsers().filter(u => u.id !== id));
        showToast('✓ User deleted');
      } else {
        showToast(result?.message || 'Failed to delete user', true);
        return;
      }
    } else {
      // ✅ SYNC DELETE TO DATABASE
      const result = await API.del(`/${type}/${id}`);
      if (result?.success) {
        Utils.saveData(type, Utils.getData(type).filter(i => i.id !== id));
        showToast('✓ Item deleted');
      } else {
        showToast(result?.message || 'Failed to delete item', true);
        return;
      }
    }
  } catch (err) {
    console.error(`Delete ${type} error:`, err);
    showToast(`Error deleting ${type}`, true);
    return;
  }
  switchTab(tabAfter[type] || 'home');
}

async function handleEditOrder(e, orderId) {
  e.preventDefault();
  const status = new FormData(e.target).get('status');
  let orders = Utils.getData('orders');
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx > -1) {
    const prevStatus = orders[idx].status;

    try {
      // ✅ SYNC STATUS UPDATE TO DATABASE
      const result = await API.put(`/orders/${orderId}/status`, { status });
      if (result?.success) {
        orders[idx].status = status;
        orders[idx].updatedAt = new Date().toISOString();
        // Record the exact date/time when the order was first completed
        if (status === 'Completed' && prevStatus !== 'Completed') {
          orders[idx].completedAt = new Date().toISOString();
        }
        Utils.saveData('orders', orders);
        closeMgmtModal();
        showToast('✓ Order status updated!');

        // If just marked Completed, fire finance sync event
        if (status === 'Completed' && prevStatus !== 'Completed') {
          window.dispatchEvent(new CustomEvent('vavh-order-completed', { detail: orders[idx] }));
          showToast('✅ Revenue added to Finance Dashboard!');
        }
        // If changed away from Completed, fire update so finance removes it
        if (prevStatus === 'Completed' && status !== 'Completed') {
          window.dispatchEvent(new CustomEvent('vavh-order-uncompleted', { detail: orders[idx] }));
        }
      } else {
        showToast(result?.message || 'Failed to update order status', true);
        return;
      }
    } catch (err) {
      console.error('Order status update error:', err);
      showToast('Error updating order status', true);
      return;
    }

    switchTab('orders');
  }
}

/* ── Live due calculator for New Order form ── */
function updateOrderDueCalc() {
  const prodSel = document.getElementById('ord-prod');
  const qtyEl = document.getElementById('ord-qty');
  const totalEl = document.getElementById('ord-due-total');
  const paidEl = document.getElementById('ord-due-paid');
  const summary = document.getElementById('ord-due-summary');
  if (!prodSel || !totalEl || !paidEl) return;

  // Auto-fill total from product price × qty if user hasn't manually changed it
  const opt = prodSel.options[prodSel.selectedIndex];
  const price = parseFloat(opt?.getAttribute('data-p')) || 0;
  const qty = parseInt(qtyEl?.value) || 1;
  if (price > 0 && !totalEl._manuallyEdited) {
    totalEl.value = (price * qty).toFixed(2);
  }

  const total = parseFloat(totalEl.value) || 0;
  const paid = parseFloat(paidEl.value) || 0;
  const remaining = Math.max(0, total - paid);

  if (summary) {
    summary.style.display = 'flex';
    const fmt = v => 'BDT ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const remEl = document.getElementById('ord-due-sum-remaining');
    document.getElementById('ord-due-sum-total').textContent = fmt(total);
    document.getElementById('ord-due-sum-paid').textContent = fmt(paid);
    if (remEl) { remEl.textContent = fmt(remaining); remEl.style.color = remaining > 0 ? '#ffc107' : '#4caf50'; }
  }
}

/* Mark total as manually edited if user types in it */
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('input', e => {
    if (e.target && e.target.id === 'ord-due-total') e.target._manuallyEdited = true;
  });
  // Also wire product select change to auto-fill
  document.addEventListener('change', e => {
    if (e.target && e.target.id === 'ord-prod') {
      const totalEl = document.getElementById('ord-due-total');
      if (totalEl) totalEl._manuallyEdited = false; // reset on product change
      updateOrderDueCalc();
    }
  });
});

async function handleOrderSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const select = document.getElementById('ord-prod');
  const custSel = document.getElementById('ord-cust');

  if (!custSel.value) { showToast('Please select a customer!', true); return; }

  const opt = select.options[select.selectedIndex];
  const qty = parseInt(formData.get('qty'));
  const pId = formData.get('productId');

  let products = Utils.getData('products');
  const pIdx = products.findIndex(p => p.id === pId);

  if (pIdx === -1) { showToast('Product not found!', true); return; }
  if (parseInt(products[pIdx].stock) < qty) { showToast('Insufficient stock! Available: ' + products[pIdx].stock, true); return; }

  const dueTotal = parseFloat(formData.get('dueTotal')) || (parseFloat(opt.getAttribute('data-p')) * qty);
  const duePaid = parseFloat(formData.get('duePaid')) || 0;
  const dueRemaining = Math.max(0, dueTotal - duePaid);

  try {
    // ✅ SYNC CREATE ORDER TO DATABASE (API handles stock deduction)
    const result = await API.post('/orders', {
      customerName: custSel.value,
      productId: pId,
      productName: opt.getAttribute('data-n'),
      qty,
      total: (parseFloat(opt.getAttribute('data-p')) * qty).toFixed(2),
      financeNameDue: formData.get('financeNameDue') || '',
      dueTotal: dueTotal.toFixed(2),
      duePaid: duePaid.toFixed(2),
      dueRemaining: dueRemaining.toFixed(2)
    });

    if (result?.success) {
      // Update local cache: decrement stock and add order
      products[pIdx].stock = parseInt(products[pIdx].stock) - qty;
      Utils.saveData('products', products);

      const existingOrders = Utils.getData('orders');
      const order = {
        id: result.id,
        customerName: custSel.value,
        productName: opt.getAttribute('data-n'),
        productId: pId,
        qty,
        total: (parseFloat(opt.getAttribute('data-p')) * qty).toFixed(2),
        status: 'Pending',
        createdAt: new Date().toISOString(),
        financeNameDue: formData.get('financeNameDue') || '',
        dueTotal: dueTotal.toFixed(2),
        duePaid: duePaid.toFixed(2),
        dueRemaining: dueRemaining.toFixed(2)
      };
      existingOrders.unshift(order);
      Utils.saveData('orders', existingOrders);

      closeMgmtModal();
      showToast('✓ Order Created: ' + result.id);
      switchTab('orders');
    } else {
      showToast(result?.message || 'Failed to create order', true);
    }
  } catch (err) {
    console.error('Order creation error:', err);
    showToast('Error creating order', true);
  }
}

/* ── Quick customer creation from order modal ── */
function openCreateCustomerModal() {
  const overlay = document.getElementById('mgmt-modal-overlay');
  document.getElementById('mgmt-generic-modal').classList.add('hidden');
  let existing = document.getElementById('quick-cust-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'quick-cust-modal';
  modal.className = 'modal-box-mgmt';
  modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2000;width:400px;';
  modal.innerHTML = `
    <div class="modal-header-mgmt"><h3>Create New Customer</h3><button type="button" class="modal-close-btn" onclick="document.getElementById('quick-cust-modal').remove()"><i class="fas fa-times"></i></button></div>
    <form onsubmit="handleQuickCustomerCreate(event)">
      <label class="form-label-mgmt">Name *</label>
      <input type="text" id="qc-name" class="form-input-mgmt" placeholder="Customer name" required style="margin-bottom:10px;">
      <label class="form-label-mgmt">Phone *</label>
      <input type="text" id="qc-phone" class="form-input-mgmt" placeholder="Phone number" required style="margin-bottom:10px;">
      <label class="form-label-mgmt">Address</label>
      <textarea id="qc-addr" class="form-input-mgmt" placeholder="Address (optional)" style="margin-bottom:14px;height:70px;"></textarea>
      <div style="display:flex;gap:10px;">
        <button type="submit" class="btn-primary-mgmt" style="flex:1">Create &amp; Select</button>
        <button type="button" class="btn-export-mgmt" style="flex:1" onclick="document.getElementById('quick-cust-modal').remove()">Cancel</button>
      </div>
    </form>`;
  overlay.appendChild(modal);
  document.getElementById('qc-name').focus();
}

function handleQuickCustomerCreate(e) {
  e.preventDefault();
  const name = document.getElementById('qc-name').value.trim();
  const contact = document.getElementById('qc-phone').value.trim();
  const address = document.getElementById('qc-addr').value.trim();
  if (!name || !contact) { showToast('Name and phone required!', true); return; }

  const customers = Utils.getData('customers');
  if (customers.find(c => c.name.toLowerCase() === name.toLowerCase())) { showToast('Customer already exists!', true); return; }

  const newCustomer = { id: Utils.uid(), name, contact, address: address || 'N/A' };
  customers.push(newCustomer);
  Utils.saveData('customers', customers);

  const sel = document.getElementById('ord-cust');
  if (sel) { const opt = document.createElement('option'); opt.value = name; opt.textContent = name; opt.selected = true; sel.appendChild(opt); }

  document.getElementById('quick-cust-modal').remove();
  document.getElementById('mgmt-generic-modal').classList.remove('hidden');
  showToast('Customer created and selected!');
}

/* ── Profile update ── */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function previewImage(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => document.getElementById('preview-avatar').src = e.target.result;
    reader.readAsDataURL(input.files[0]);
  }
}

function previewProductImage(event) {
  const file = event.target.files && event.target.files[0];
  const preview = document.getElementById('mgmt-product-image-preview');
  const hiddenInput = document.getElementById('mgmt-product-image-value');
  if (!file || !preview) return;
  const reader = new FileReader();
  reader.onload = e => {
    preview.src = e.target.result;
    preview.style.display = 'block';
    if (hiddenInput) hiddenInput.value = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  if (!currentUser) return;
  const name = document.getElementById('prof-name').value.trim();
  const desig = document.getElementById('prof-designation').value.trim();
  const pass = document.getElementById('prof-pass').value;
  const rawSrc = document.getElementById('preview-avatar').src;
  // Only save avatar if it's a real data URL (user actually uploaded something)
  const avatar = rawSrc.startsWith('data:') ? rawSrc : (currentUser.avatar || '');

  if (!name) { showToast('Name cannot be empty!', true); return; }

  try {
    const result = await API.put('/users/profile', {
      name,
      designation: desig,
      ...(pass ? { password: pass } : {}),
      ...(avatar ? { avatar } : {}),
    });
    if (!result?.success) throw new Error(result?.message || 'Profile update failed.');
    currentUser = result.user || { ...currentUser, name, designation: desig, avatar };
    Auth.updateSidebarUser(currentUser);
    closeMgmtModal();
    showToast('Profile updated!');
  } catch (err) {
    showToast(err.message || 'Profile update failed.', true);
  }
}

/* ── CSV export ── */
function exportToCSV(type) {
  const data = Utils.getData(type);
  if (data.length === 0) { showToast('No data to export!', true); return; }
  const keys = Object.keys(data[0]);
  let csv = keys.join(',') + '\n';
  data.forEach(item => {
    csv += keys.map(k => {
      let v = item[k]; if (typeof v === 'string' && v.includes(',')) v = `"${v}"`;
      return v;
    }).join(',') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${type}_${Utils.today()}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast('Export successful!');
}

/* ── Global search ── (upgraded version defined below in cross-page search block) */
// handleGlobalSearch is redefined after the CROSS-PAGE SEARCH MAPPING block.
// This stub is kept only as a placeholder; the real implementation overrides it.
function handleGlobalSearch(query) {
  // Will be overridden by the upgraded version in the deferred script block.
  // This should never run in practice.
}

function renderSearchSection(label, data, cols, rowFn) {
  let h = `<div style="margin-bottom:24px;"><h4 style="color:var(--accent-green);margin-bottom:10px;">${label} (${data.length})</h4><div style="overflow-x:auto;"><table class="data-table"><thead><tr>`;
  cols.forEach(c => h += `<th>${c}</th>`);
  h += `<th>Actions</th></tr></thead><tbody>`;
  data.forEach(item => h += `<tr>${rowFn(item)}</tr>`);
  return h + `</tbody></table></div></div>`;
}

/* =====================================================================
   CHAT FUNCTIONALITY
   ===================================================================== */
function initializeChatData() {
  ['chats', 'messages'].forEach(k => {
    if (!localStorage.getItem(`${MGMT_KEY}_${k}`)) {
      localStorage.setItem(`${MGMT_KEY}_${k}`, JSON.stringify([]));
    }
  });
}

function renderChatView(container) {
  const chats = Utils.getData('chats');
  const userChats = chats.filter(c => c.members.includes(currentUser.id));

  let html = `<div class="chat-container">
    <div class="glass-panel chat-sidebar">
      <div style="padding:12px;">
        <button class="btn-primary-mgmt" style="width:100%;font-size:12px;" onclick="openChatModal()"><i class="fas fa-plus"></i> New Chat</button>
      </div>
      <div class="chat-list" style="padding:8px;">`;

  if (userChats.length === 0) {
    html += `<div style="text-align:center;padding:24px;color:var(--text-muted-dark);"><i class="fas fa-comments" style="font-size:2rem;opacity:0.3;margin-bottom:8px;display:block;"></i><p>No conversations yet</p></div>`;
  } else {
    userChats.forEach(chat => {
      const msgs = getChatMessages(chat.id);
      const lastMsg = msgs[msgs.length - 1];
      const preview = lastMsg ? Utils.truncate(lastMsg.message, 35) : 'No messages';
      html += `<div class="chat-item glass-panel ${currentChatId === chat.id ? 'active' : ''}" onclick="selectChat('${chat.id}')">
        <div style="font-weight:600;font-size:13px;">${Utils.esc(chat.name)}</div>
        <div style="font-size:11px;color:var(--text-muted-dark);">${Utils.esc(preview)}</div>
      </div>`;
    });
  }

  html += `</div></div>
    <div class="glass-panel chat-window">
      ${currentChatId ? renderChatWindow() : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted-dark);text-align:center;"><div><i class="fas fa-comments" style="font-size:3rem;opacity:0.3;margin-bottom:12px;display:block;"></i><p>Select a chat to start messaging</p></div></div>'}
    </div>
  </div>`;

  container.innerHTML = html;
  setTimeout(() => { const mc = document.getElementById('chat-messages'); if (mc) mc.scrollTop = mc.scrollHeight; }, 80);
}

function renderChatWindow() {
  const chats = Utils.getData('chats');
  const chat = chats.find(c => c.id === currentChatId);
  if (!chat || !chat.members.includes(currentUser.id)) return '<div style="padding:20px;color:var(--text-muted-dark);">No access to this chat.</div>';

  const messages = getChatMessages(currentChatId);
  let html = `<div class="chat-top"><h3>${Utils.esc(chat.name)}</h3><small style="color:var(--text-muted-dark)">${chat.members.length > 2 ? chat.members.length + ' members' : 'Direct message'}</small></div>
    <div class="chat-messages" id="chat-messages">`;

  if (messages.length === 0) {
    html += '<div style="color:var(--text-muted-dark);text-align:center;margin:auto;">Start the conversation!</div>';
  } else {
    messages.forEach(msg => {
      const isOwn = msg.senderId === currentUser.id;
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      html += `<div class="message ${isOwn ? 'own' : ''}">
        <div style="display:flex;flex-direction:column;align-items:${isOwn ? 'flex-end' : 'flex-start'};gap:2px;">
          ${!isOwn ? `<span class="message-sender">${Utils.esc(msg.sender)}</span>` : ''}
          <div class="message-bubble">${Utils.esc(msg.message)}</div>
          <span class="message-time">${time}</span>
        </div>
      </div>`;
    });
  }

  html += `</div>
    <div class="chat-input-area">
      <input type="text" id="chat-input" placeholder="Type a message..." onkeydown="if(event.key==='Enter'){event.preventDefault();sendMessage();}">
      <button class="chat-send-btn" onclick="sendMessage()"><i class="fas fa-paper-plane"></i></button>
    </div>`;
  return html;
}

function getChatMessages(chatId) {
  return (Utils.getData('messages') || []).filter(m => m.chatId === chatId).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function selectChat(chatId) {
  const chat = Utils.getData('chats').find(c => c.id === chatId);
  if (chat && chat.members.includes(currentUser.id)) {
    currentChatId = chatId;
    renderChatView(document.getElementById('mgmt-content'));
  }
}

function sendMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;

  const chats = Utils.getData('chats');
  const chat = chats.find(c => c.id === currentChatId);
  if (!chat || !chat.members.includes(currentUser.id)) { showToast('Cannot send message', true); return; }

  const messages = Utils.getData('messages') || [];
  messages.push({ id: Utils.uid(), chatId: currentChatId, sender: currentUser.name, senderId: currentUser.id, message: msg, timestamp: new Date().toISOString() });
  Utils.saveData('messages', messages);
  input.value = '';
  renderChatView(document.getElementById('mgmt-content'));
}

function openChatModal() {
  const overlay = document.getElementById('mgmt-modal-overlay');
  overlay.classList.remove('hidden');
  document.getElementById('mgmt-generic-modal').classList.add('hidden');
  document.getElementById('mgmt-profile-modal').classList.add('hidden');
  document.getElementById('mgmt-chat-modal').classList.remove('hidden');

  const users = Auth.getUsers().filter(u => u.id !== currentUser.id);
  document.getElementById('user-list-chat').innerHTML = users.map(u => `
    <label style="display:flex;align-items:center;padding:9px;background:rgba(76,175,80,0.1);border-radius:8px;cursor:pointer;">
      <input type="checkbox" data-uid="${u.id}" data-uname="${Utils.esc(u.name)}" style="margin-right:10px;width:16px;height:16px;">
      <span>${Utils.esc(u.name)}</span>
    </label>`).join('');
  document.getElementById('group-name-input').value = '';
}

function closeChatModal() {
  document.getElementById('mgmt-chat-modal').classList.add('hidden');
  document.getElementById('mgmt-modal-overlay').classList.add('hidden');
}

function createChatGroup() {
  const selected = Array.from(document.querySelectorAll('#user-list-chat input:checked'));
  if (selected.length === 0) { showToast('Select at least one user', true); return; }

  const selectedIds = selected.map(el => el.dataset.uid);
  const selectedNames = selected.map(el => el.dataset.uname);
  let groupName = document.getElementById('group-name-input').value.trim();
  if (!groupName) groupName = selectedIds.length === 1 ? selectedNames[0] : 'Group Chat';

  const chats = Utils.getData('chats');
  // Avoid duplicate 1:1 chats
  if (selectedIds.length === 1) {
    const existing = chats.find(c => c.members.length === 2 && c.members.includes(currentUser.id) && c.members.includes(selectedIds[0]));
    if (existing) { currentChatId = existing.id; closeChatModal(); switchTab('chat'); return; }
  }

  const newChat = { id: Utils.uid(), name: groupName, members: [currentUser.id, ...selectedIds], createdAt: new Date().toISOString() };
  chats.push(newChat);
  Utils.saveData('chats', chats);
  currentChatId = newChat.id;
  closeChatModal();
  switchTab('chat');
  showToast('Chat created!');
}

/* =====================================================================
   FINANCE MESSAGING — shared chat system (same data as Management chat)
   Reuses: initializeChatData, getChatMessages, sendMessage, openChatModal,
           createChatGroup, selectChat — all defined in the Management section.
   ===================================================================== */
function renderFinMessages() {
  initializeChatData();
  const container = document.getElementById('fin-messages-content');
  if (!container) return;

  const chats = Utils.getData('chats');
  const userChats = chats.filter(c => c.members.includes(currentUser.id));

  /* Build the same two-panel layout used by Management chat,
     but styled with Finance (light) theme */
  let sideItems = '';
  if (userChats.length === 0) {
    sideItems = `<div style="text-align:center;padding:24px;color:var(--text-muted)">
      <i class="fas fa-comments" style="font-size:2rem;opacity:.3;margin-bottom:8px;display:block;"></i>
      <p>No conversations yet</p></div>`;
  } else {
    userChats.forEach(chat => {
      const msgs = getChatMessages(chat.id);
      const lastMsg = msgs[msgs.length - 1];
      const preview = lastMsg ? Utils.truncate(lastMsg.message, 38) : 'No messages yet';
      const isActive = currentChatId === chat.id;
      sideItems += `<div onclick="finSelectChat('${chat.id}')" style="
          padding:12px 14px;border-radius:var(--radius-sm);cursor:pointer;margin-bottom:4px;
          background:${isActive ? 'var(--accent-light)' : 'transparent'};
          border:1px solid ${isActive ? 'rgba(91,106,245,0.25)' : 'transparent'};
          transition:all var(--transition);"
          onmouseover="if(!this.classList.contains('fin-chat-active'))this.style.background='var(--bg-primary)'"
          onmouseout="if(!this.classList.contains('fin-chat-active'))this.style.background='transparent'">
        <div style="font-weight:600;font-size:13px;color:var(--text-primary)">${Utils.esc(chat.name)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${Utils.esc(preview)}</div>
      </div>`;
    });
  }

  /* Chat window content */
  let chatWindowHtml = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);text-align:center;">
    <div><i class="fas fa-comments" style="font-size:3rem;opacity:.25;display:block;margin-bottom:12px;"></i>
    <p>Select a conversation to start messaging</p></div></div>`;

  if (currentChatId) {
    const chat = chats.find(c => c.id === currentChatId);
    if (chat && chat.members.includes(currentUser.id)) {
      const messages = getChatMessages(currentChatId);
      let msgsHtml = messages.length === 0
        ? `<div style="text-align:center;color:var(--text-muted);margin:auto;">Start the conversation!</div>`
        : messages.map(msg => {
          const isOwn = msg.senderId === currentUser.id;
          const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `<div style="display:flex;flex-direction:column;align-items:${isOwn ? 'flex-end' : 'flex-start'};margin-bottom:10px;gap:2px;">
              ${!isOwn ? `<span style="font-size:11px;color:var(--text-muted);margin-left:4px;">${Utils.esc(msg.sender)}</span>` : ''}
              <div style="max-width:70%;padding:9px 13px;border-radius:${isOwn ? '14px 14px 3px 14px' : '14px 14px 14px 3px'};
                background:${isOwn ? 'var(--accent)' : '#fff'};color:${isOwn ? '#fff' : 'var(--text-primary)'};
                font-size:13px;box-shadow:var(--shadow-sm);border:${isOwn ? 'none' : '1px solid var(--border)'}">
                ${Utils.esc(msg.message)}
              </div>
              <span style="font-size:10px;color:var(--text-muted)">${time}</span>
            </div>`;
        }).join('');

      chatWindowHtml = `
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);background:#fff;border-radius:var(--radius) var(--radius) 0 0;">
          <div style="font-weight:700;font-size:15px;color:var(--text-primary)">${Utils.esc(chat.name)}</div>
          <div style="font-size:11px;color:var(--text-muted)">${chat.members.length > 2 ? chat.members.length + ' members' : 'Direct message'} · shared with Management</div>
        </div>
        <div id="fin-chat-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;">${msgsHtml}</div>
        <div style="padding:12px 16px;border-top:1px solid var(--border);background:#fff;display:flex;gap:10px;align-items:center;border-radius:0 0 var(--radius) var(--radius);">
          <input type="text" id="fin-chat-input" placeholder="Type a message…"
            style="flex:1;padding:10px 14px;border:1.5px solid var(--border);border-radius:20px;outline:none;font-family:'Poppins',sans-serif;font-size:13px;background:var(--bg-primary);"
            onkeydown="if(event.key==='Enter'){event.preventDefault();finSendMessage();}">
          <button onclick="finSendMessage()" style="width:38px;height:38px;border-radius:50%;background:var(--accent);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-paper-plane" style="font-size:13px;"></i>
          </button>
        </div>`;
    }
  }

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:260px 1fr;gap:16px;height:calc(100vh - 130px);">
      <!-- Sidebar -->
      <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column;">
        <div style="padding:14px;border-bottom:1px solid var(--border);">
          <button class="btn btn-pri btn-sm" style="width:100%" onclick="openChatModal()">
            <i class="fas fa-plus"></i> New Chat
          </button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:8px;">${sideItems}</div>
      </div>
      <!-- Chat window -->
      <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius);display:flex;flex-direction:column;overflow:hidden;">
        ${chatWindowHtml}
      </div>
    </div>`;

  // Scroll to bottom
  setTimeout(() => {
    const mc = document.getElementById('fin-chat-messages');
    if (mc) mc.scrollTop = mc.scrollHeight;
  }, 60);
}

/* Finance-side chat selection — sets currentChatId then re-renders */
function finSelectChat(chatId) {
  const chat = Utils.getData('chats').find(c => c.id === chatId);
  if (chat && chat.members.includes(currentUser.id)) {
    currentChatId = chatId;
    renderFinMessages();
  }
}

/* Finance-side send — reuses same localStorage store as Management */
function finSendMessage() {
  const input = document.getElementById('fin-chat-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;

  const chats = Utils.getData('chats');
  const chat = chats.find(c => c.id === currentChatId);
  if (!chat || !chat.members.includes(currentUser.id)) { FU.toast('Cannot send message', 'error'); return; }

  const messages = Utils.getData('messages') || [];
  messages.push({ id: Utils.uid(), chatId: currentChatId, sender: currentUser.name, senderId: currentUser.id, message: msg, timestamp: new Date().toISOString() });
  Utils.saveData('messages', messages);
  input.value = '';
  renderFinMessages(); // re-render Finance chat
}

/* Also wire openChatModal to re-render Finance messages after group creation if in Finance module */
const _origCreateChatGroup = createChatGroup;
// Patch switchTab('chat') call inside createChatGroup to also refresh Finance view
window.createChatGroup = function () {
  const selected = Array.from(document.querySelectorAll('#user-list-chat input:checked'));
  if (selected.length === 0) { showToast('Select at least one user', true); return; }
  const selectedIds = selected.map(el => el.dataset.uid);
  const selectedNames = selected.map(el => el.dataset.uname);
  let groupName = document.getElementById('group-name-input').value.trim();
  if (!groupName) groupName = selectedIds.length === 1 ? selectedNames[0] : 'Group Chat';
  const chats = Utils.getData('chats');
  if (selectedIds.length === 1) {
    const existing = chats.find(c => c.members.length === 2 && c.members.includes(currentUser.id) && c.members.includes(selectedIds[0]));
    if (existing) {
      currentChatId = existing.id;
      closeChatModal();
      if (currentModule === 'finance') renderFinMessages();
      else switchTab('chat');
      return;
    }
  }
  const newChat = { id: Utils.uid(), name: groupName, members: [currentUser.id, ...selectedIds], createdAt: new Date().toISOString() };
  chats.push(newChat);
  Utils.saveData('chats', chats);
  currentChatId = newChat.id;
  closeChatModal();
  if (currentModule === 'finance') { renderFinMessages(); FU.toast('Chat created!', 'success'); }
  else { switchTab('chat'); showToast('Chat created!'); }
};

/* ── Page navigation ── */
function finNavigate(page) {
  currentFinPage = page;

  document.querySelectorAll('.fin-page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('fin-page-' + page);
  if (pg) pg.classList.add('active');

  setNavActive('#nav-finance', `#nav-finance .nav-item[data-fin-page="${page}"]`);

  if (page === 'dashboard') FinDashboard.init();
  else if (page === 'investments') Investments.render();
  else if (page === 'order-revenue') OrderRevenue.render();
  else if (page === 'due-tracker') DueTracker.render();
  else if (page === 'expenses') Expenses.render();
  else if (page === 'products') FinProducts.render();
  else if (page === 'marketing') Marketing.render();
  else if (page === 'inventory') Inventory.render();
  else if (page === 'dealer-supplier') DealerSupplier.render();
  else if (page === 'fn-builder') FnBuilder.init();
  else if (page === 'fin-messages') renderFinMessages();
  else if (page === 'reports') renderReports();
  else if (page === 'settings') loadSettings();
  else if (page === 'fin-users') UserMgmt.render();

  if (currentUser && currentUser.role !== 'admin') {
    document.querySelectorAll('#module-finance .btn-del.btn-icon').forEach(el => el.style.display = 'none');
  }
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

function attachFinanceNavHandlers() {
  document.querySelectorAll('#nav-finance .nav-item').forEach(btn => {
    btn.addEventListener('click', () => finNavigate(btn.dataset.finPage));
  });
}

/* =====================================================================
   FINANCE BALANCE ENGINE — single source of truth for balance calc
   ===================================================================== */
const BalanceEngine = {
  MANUAL_KEY: 'vavh_manual_balance',

  /* Compute auto balance:
     Investment - Business Expenses - Marketing - Product Costs + Completed Order Revenue */
  computeAuto() {
    const inv = Utils.lsGet('investments');
    const exp = Utils.lsGet('expenses');
    const prod = Utils.lsGet('products');
    const mkt = Utils.lsGet('marketing');
    const tI = Utils.sumBy(inv, 'amount');
    const tE = Utils.sumBy(exp, 'amount');
    const tP = Utils.sumBy(prod, 'cost');
    const tM = Utils.sumBy(mkt, 'amount');
    const completedOrders = Utils.getData('orders').filter(o => o.status === 'Completed');
    const tOR = completedOrders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    return { tI, tE, tP, tM, tOR, balance: tI - tE - tP - tM + tOR, completedOrders };
  },

  /* Returns current displayed balance — manual override takes precedence */
  getCurrent() {
    try {
      const stored = localStorage.getItem(this.MANUAL_KEY);
      if (stored !== null) return parseFloat(stored);
    } catch (e) { }
    return this.computeAuto().balance;
  },

  setManual(v) { localStorage.setItem(this.MANUAL_KEY, parseFloat(v).toFixed(2)); },
  clearManual() { localStorage.removeItem(this.MANUAL_KEY); },
  hasManual() { return localStorage.getItem(this.MANUAL_KEY) !== null; }
};

/* ── Finance Dashboard ── */
const FinDashboard = {
  _editMode: false,

  init() {
    // Use shared dashboard data — single source of truth for both modules
    const shared = getSharedDashboardData();
    const { tI, tE, tP, tM, tOR, finalBalance: autoBalance, completedOrders } = shared;
    const inv = Utils.lsGet('investments');
    const exp = Utils.lsGet('expenses');
    const prod = Utils.lsGet('products');
    const mkt = Utils.lsGet('marketing');

    // Stats cards
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('stat-investment', Utils.formatCurrency(tI));
    set('stat-expenses', Utils.formatCurrency(tE));
    set('stat-products', Utils.formatCurrency(tP));
    set('stat-marketing', Utils.formatCurrency(tM));
    set('stat-order-revenue', Utils.formatCurrency(tOR));
    set('stat-order-revenue-count', completedOrders.length + ' completed order' + (completedOrders.length !== 1 ? 's' : ''));

    // Inventory stats on dashboard — use shared data
    const invStock = shared.invStats;
    set('stat-total-stock', invStock.totalStock + ' units');
    set('stat-unsold-stock', invStock.unsold + ' unsold');

    // Balance — respect manual override
    const currentBal = BalanceEngine.getCurrent();
    set('stat-balance', Utils.formatCurrency(currentBal));

    const bc = document.getElementById('balance-change');
    if (bc) {
      bc.textContent = currentBal >= 0 ? '↑ Positive' : '↓ Negative';
      bc.className = 'card-change ' + (currentBal >= 0 ? 'positive' : 'negative');
    }
    // Show formula hint or manual tag
    const hint = document.getElementById('balance-formula-hint');
    if (hint) {
      if (BalanceEngine.hasManual()) {
        hint.innerHTML = '<span style="color:#f59e0b;font-weight:600;">✏️ Manually adjusted</span> · <a href="#" onclick="FinDashboard.resetToAutoBalance();return false;" style="color:var(--accent);font-size:11px;">Reset to auto</a>';
      } else {
        hint.textContent = '= Investment − Expenses + Completed Orders';
      }
    }

    // Reset edit mode UI if init called externally
    if (!this._editMode) {
      const ew = document.getElementById('balance-edit-wrap');
      const dw = document.getElementById('balance-display-wrap');
      if (ew) ew.style.display = 'none';
      if (dw) dw.style.display = '';
    }

    // Recent transactions
    const all = [
      ...inv.map(i => ({ type: 'investment', name: i.investorName, amount: parseFloat(i.amount) || 0, date: i.date, label: 'Investment', icon: '💼' })),
      ...exp.map(e => ({ type: 'expense', name: e.employeeName, amount: parseFloat(e.amount) || 0, date: e.date, label: Utils.truncate(e.reason || 'Expense', 20), icon: '📋' })),
      ...prod.map(p => ({ type: 'product', name: p.productName, amount: parseFloat(p.cost) || 0, date: p.date, label: Utils.truncate(p.itemName || 'Product', 20), icon: '📦' })),
      ...mkt.map(m => ({ type: 'marketing', name: m.platform, amount: parseFloat(m.amount) || 0, date: m.date, label: Utils.truncate(m.campaignName || 'Campaign', 20), icon: '📢' })),
      ...completedOrders.map(o => ({ type: 'order-revenue', name: o.customerName, amount: parseFloat(o.total) || 0, date: o.completedAt || o.updatedAt || o.createdAt, label: 'Order ' + o.id, icon: '🛍️' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    const rl = document.getElementById('recentList');
    if (rl) rl.innerHTML = all.length === 0
      ? '<div class="empty-state"><div class="empty-icon">📊</div><p>No transactions yet.</p></div>'
      : all.map(tx => `<li class="recent-item">
          <div class="tx-icon">${tx.icon}</div>
          <div class="tx-info"><div class="tx-name">${Utils.esc(tx.name)}</div><div class="tx-meta">${Utils.esc(tx.label)} · ${Utils.formatDate(tx.date)}</div></div>
          <div class="tx-amount ${(tx.type === 'investment' || tx.type === 'order-revenue') ? 'income' : 'expense'}">${(tx.type === 'investment' || tx.type === 'order-revenue') ? '+' : '-'}${Utils.formatCurrency(tx.amount)}</div>
        </li>`).join('');

    // Spending breakdown
    const totalSpend = tE + tP + tM || 1;
    const sb = document.getElementById('spendBreakdown');
    if (sb) sb.innerHTML = [
      { l: 'Business Expenses', v: tE, c: '#ef4444' },
      { l: 'Product Expenses', v: tP, c: '#f59e0b' },
      { l: 'Marketing & Ads', v: tM, c: '#06b6d4' }
    ].map(b => `<div class="progress-wrap">
        <div class="progress-label"><span>${b.l}</span><span>${Utils.formatCurrency(b.v)} (${(b.v / totalSpend * 100).toFixed(1)}%)</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(b.v / totalSpend * 100, 100)}%;background:${b.c}"></div></div>
      </div>`).join('');

    // Dashboard Charts
    if (typeof Chart !== 'undefined') {
      // Bar chart — Income vs Expenses
      const barCtx = document.getElementById('dash-bar-chart');
      if (barCtx) {
        if (barCtx._chartInstance) barCtx._chartInstance.destroy();
        barCtx._chartInstance = new Chart(barCtx, {
          type: 'bar',
          data: {
            labels: ['Investment', 'Order Revenue', 'Biz Expenses', 'Product Costs', 'Marketing'],
            datasets: [{
              label: 'Amount (BDT)',
              data: [tI, tOR, tE, tP, tM],
              backgroundColor: ['#22c55e', '#5b6af5', '#ef4444', '#f59e0b', '#06b6d4'],
              borderRadius: 6,
              borderSkipped: false,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' BDT ' + Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 2 }) } } },
            scales: { y: { ticks: { callback: v => 'BDT ' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) }, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } }
          }
        });
      }
      // Doughnut chart — Spending distribution
      const dCtx = document.getElementById('dash-doughnut-chart');
      if (dCtx) {
        if (dCtx._chartInstance) dCtx._chartInstance.destroy();
        dCtx._chartInstance = new Chart(dCtx, {
          type: 'doughnut',
          data: {
            labels: ['Business Expenses', 'Product Costs', 'Marketing & Ads'],
            datasets: [{ data: [tE, tP, tM], backgroundColor: ['#ef4444', '#f59e0b', '#06b6d4'], borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }]
          },
          options: {
            responsive: true, maintainAspectRatio: true, cutout: '65%',
            plugins: { legend: { position: 'bottom', labels: { padding: 14, font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => ' BDT ' + Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 2 }) } } }
          }
        });
      }
    }
  },

  /* --- Editable balance methods --- */
  toggleBalanceEdit() {
    this._editMode = !this._editMode;
    const ew = document.getElementById('balance-edit-wrap');
    const dw = document.getElementById('balance-display-wrap');
    if (!ew || !dw) return;
    if (this._editMode) {
      ew.style.display = '';
      dw.style.display = 'none';
      const inp = document.getElementById('balance-manual-input');
      if (inp) {
        inp.value = parseFloat(BalanceEngine.getCurrent()).toFixed(2);
        setTimeout(() => inp.focus(), 50);
      }
      const autoEl = document.getElementById('balance-auto-calc');
      if (autoEl) autoEl.textContent = Utils.formatCurrency(BalanceEngine.computeAuto().balance);
    } else {
      ew.style.display = 'none';
      dw.style.display = '';
    }
  },

  previewManualBalance(val) {
    const v = parseFloat(val);
    const el = document.getElementById('stat-balance');
    if (el && !isNaN(v)) el.textContent = Utils.formatCurrency(v);
  },

  saveManualBalance() {
    const inp = document.getElementById('balance-manual-input');
    const v = parseFloat(inp?.value);
    if (isNaN(v)) { FU.toast('Please enter a valid number.', 'error'); return; }
    BalanceEngine.setManual(v);
    this._editMode = false;
    FU.toast('Balance manually updated!', 'success');
    this.init();
  },

  cancelBalanceEdit() {
    this._editMode = false;
    this.init();
  },

  resetToAutoBalance() {
    if (!confirm('Reset to auto-calculated balance? This will remove your manual override.')) return;
    BalanceEngine.clearManual();
    this._editMode = false;
    FU.toast('Balance reset to auto-calculated.', 'info');
    this.init();
  }
};

/* ── SVG icons for finance tables ── */
const EDIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const DEL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

/* ── Investments ── */
const Investments = {
  KEY: 'investments', sortKey: 'date', sortDir: 'desc', editId: null,
  getData() { return Utils.lsGet(this.KEY); },
  saveData(d) { Utils.lsSet(this.KEY, d); },

  getInvestorNames() { return [...new Set(this.getData().map(d => d.investorName).filter(Boolean))].sort((a, b) => a.localeCompare(b)); },

  initAutocomplete() {
    const input = document.getElementById('investorNameInput');
    const dropdown = document.getElementById('investorDropdown');
    if (!input || !dropdown) return;
    // Remove any previous listener to avoid accumulation on repeated modal opens
    if (this._autoCloseHandler) {
      document.removeEventListener('click', this._autoCloseHandler);
    }
    let focusIdx = -1;

    const show = (q = '') => {
      const names = this.getInvestorNames();
      const list = q ? names.filter(n => n.toLowerCase().includes(q.toLowerCase())) : names;
      if (!list.length) { dropdown.classList.remove('open'); return; }
      dropdown.innerHTML = list.map((n, i) => {
        const entries = this.getData().filter(d => d.investorName === n);
        const total = Utils.sumBy(entries, 'amount');
        return `<div class="investor-option" data-name="${Utils.esc(n)}" data-idx="${i}">
          <div class="inv-avatar">${n[0].toUpperCase()}</div>
          <div><div>${Utils.esc(n)}</div><div class="inv-meta">${entries.length} investment${entries.length !== 1 ? 's' : ''} · ${Utils.formatCurrency(total)}</div></div>
        </div>`;
      }).join('');
      focusIdx = -1; dropdown.classList.add('open');
      dropdown.querySelectorAll('.investor-option').forEach(opt => {
        opt.addEventListener('mousedown', e => { e.preventDefault(); input.value = opt.dataset.name; dropdown.classList.remove('open'); });
      });
    };

    input.addEventListener('input', () => show(input.value));
    input.addEventListener('focus', () => show(input.value));
    input.addEventListener('keydown', e => {
      const opts = dropdown.querySelectorAll('.investor-option');
      if (e.key === 'ArrowDown') { e.preventDefault(); focusIdx = Math.min(focusIdx + 1, opts.length - 1); opts.forEach((o, i) => o.classList.toggle('focused', i === focusIdx)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusIdx = Math.max(focusIdx - 1, 0); opts.forEach((o, i) => o.classList.toggle('focused', i === focusIdx)); }
      else if (e.key === 'Enter' && focusIdx >= 0) { e.preventDefault(); input.value = opts[focusIdx].dataset.name; dropdown.classList.remove('open'); }
      else if (e.key === 'Escape') dropdown.classList.remove('open');
    });
    this._autoCloseHandler = e => {
      if (!document.getElementById('investorComboWrap')?.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    };
    document.addEventListener('click', this._autoCloseHandler);
  },

  openForm(record = null) {
    this.editId = record ? record.id : null;
    const form = document.getElementById('investmentForm');
    document.getElementById('inv-modalTitle').textContent = record ? 'Edit Investment' : 'Add New Investment';
    if (record) { form.investorName.value = record.investorName || ''; form.amount.value = record.amount || ''; form.date.value = record.date || ''; form.method.value = record.method || 'Cash'; form.notes.value = record.notes || ''; }
    else { form.reset(); form.date.value = Utils.today(); }
    FU.openModal('investmentModal');
    this.initAutocomplete();
    setTimeout(() => document.getElementById('investorNameInput').focus(), 60);
  },

  saveRecord() {
    const form = document.getElementById('investmentForm');
    const rec = { id: this.editId || Utils.uid(), investorName: form.investorName.value.trim(), amount: parseFloat(form.amount.value) || 0, date: form.date.value, method: form.method.value, notes: form.notes.value.trim() };
    if (!rec.investorName || !rec.amount || !rec.date) { FU.toast('Please fill in all required fields.', 'error'); return; }
    let data = this.getData();
    if (this.editId) { data = data.map(d => d.id === this.editId ? rec : d); FU.toast('Investment updated!', 'success'); }
    else { data.push(rec); FU.toast('Investment added!', 'success'); }
    this.saveData(data); FU.closeModal('investmentModal'); this.render(); SheetsSync.autoSync('investments');
  },

  editById(id) { const r = this.getData().find(d => d.id === id); if (r) this.openForm(r); },
  deleteRecord(id) {
    const data = this.getData(), item = data.find(d => d.id === id);
    if (!item || !Utils.confirmDelete(item.investorName)) return;
    this.saveData(data.filter(d => d.id !== id)); FU.toast('Deleted.', 'info'); this.render(); SheetsSync.autoSync('investments');
  },

  render() {
    const all = this.getData(), total = Utils.sumBy(all, 'amount');
    document.getElementById('inv-totalCount').textContent = all.length + ' records';
    document.getElementById('inv-totalAmount').textContent = Utils.formatCurrency(total);
    let data = [...all];
    const s = document.getElementById('inv-search')?.value.toLowerCase() || '';
    if (s) data = data.filter(d => d.investorName?.toLowerCase().includes(s) || d.method?.toLowerCase().includes(s) || d.notes?.toLowerCase().includes(s));
    data = Utils.sortTable(data, this.sortKey, this.sortDir);
    document.getElementById('inv-tableBody').innerHTML = data.length === 0
      ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">💼</div><p>No investments found.</p></div></td></tr>`
      : data.map(d => `<tr>
          <td><span class="fw-600">${Utils.esc(d.investorName)}</span></td>
          <td><span class="currency color-success">${Utils.formatCurrency(d.amount)}</span></td>
          <td class="td-muted">${Utils.formatDate(d.date)}</td>
          <td><span class="badge ${Utils.paymentBadge(d.method)}">${Utils.esc(d.method)}</span></td>
          <td class="td-muted">${Utils.esc(Utils.truncate(d.notes || '—', 40))}</td>
          <td><div class="td-actions">
            <button class="btn btn-sm btn-sec btn-icon" onclick="Investments.editById('${d.id}')">${EDIT_SVG}</button>
            <button class="btn btn-sm btn-del btn-icon" onclick="Investments.deleteRecord('${d.id}')">${DEL_SVG}</button>
          </div></td>
        </tr>`).join('');
  }
};

/* ── Expenses ── */
const Expenses = {
  KEY: 'expenses', sortKey: 'date', sortDir: 'desc', editId: null, pendingFile: null,
  getData() { return Utils.lsGet(this.KEY); },
  saveData(d) { Utils.lsSet(this.KEY, d); },

  openForm(record = null) {
    this.editId = record ? record.id : null; this.pendingFile = null;
    const form = document.getElementById('expenseForm');
    document.getElementById('exp-modalTitle').textContent = record ? 'Edit Expense' : 'Add Business Expense';
    document.getElementById('exp-fileName').textContent = '';
    if (record) { form.employeeName.value = record.employeeName || ''; form.amount.value = record.amount || ''; form.date.value = record.date || ''; form.reason.value = record.reason || ''; this.pendingFile = record.attachment || null; if (record.attachment) document.getElementById('exp-fileName').textContent = ' ' + record.attachment; }
    else { form.reset(); form.date.value = Utils.today(); }
    FU.openModal('expenseModal'); form.employeeName.focus();
  },

  saveRecord() {
    const form = document.getElementById('expenseForm');
    const rec = { id: this.editId || Utils.uid(), employeeName: form.employeeName.value.trim(), amount: parseFloat(form.amount.value) || 0, date: form.date.value, reason: form.reason.value.trim(), attachment: this.pendingFile || '' };
    if (!rec.employeeName || !rec.amount || !rec.date) { FU.toast('Please fill in all required fields.', 'error'); return; }
    let data = this.getData();
    if (this.editId) { data = data.map(d => d.id === this.editId ? rec : d); FU.toast('Expense updated!', 'success'); }
    else { data.push(rec); FU.toast('Expense added!', 'success'); }
    this.saveData(data); FU.closeModal('expenseModal'); this.render(); SheetsSync.autoSync('expenses');
  },

  editById(id) { const r = this.getData().find(d => d.id === id); if (r) this.openForm(r); },
  deleteRecord(id) {
    const data = this.getData(), item = data.find(d => d.id === id);
    if (!item || !Utils.confirmDelete(item.employeeName)) return;
    this.saveData(data.filter(d => d.id !== id)); FU.toast('Deleted.', 'info'); this.render(); SheetsSync.autoSync('expenses');
  },

  render() {
    const all = this.getData(), total = Utils.sumBy(all, 'amount');
    document.getElementById('exp-totalCount').textContent = all.length + ' records';
    document.getElementById('exp-totalAmount').textContent = Utils.formatCurrency(total);
    let data = [...all];
    const s = document.getElementById('exp-search')?.value.toLowerCase() || '';
    if (s) data = data.filter(d => d.employeeName?.toLowerCase().includes(s) || d.reason?.toLowerCase().includes(s));
    data = Utils.sortTable(data, this.sortKey, this.sortDir);
    document.getElementById('exp-tableBody').innerHTML = data.length === 0
      ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📋</div><p>No expenses found.</p></div></td></tr>`
      : data.map(d => `<tr>
          <td><span class="fw-600">${Utils.esc(d.employeeName)}</span></td>
          <td><span class="currency color-danger">${Utils.formatCurrency(d.amount)}</span></td>
          <td class="td-muted">${Utils.formatDate(d.date)}</td>
          <td>${Utils.esc(Utils.truncate(d.reason || '—', 40))}</td>
          <td>${d.attachment ? `<span class="badge badge-blue">${Utils.esc(Utils.truncate(d.attachment, 20))}</span>` : '<span class="td-muted">—</span>'}</td>
          <td><div class="td-actions">
            <button class="btn btn-sm btn-sec btn-icon" onclick="Expenses.editById('${d.id}')">${EDIT_SVG}</button>
            <button class="btn btn-sm btn-del btn-icon" onclick="Expenses.deleteRecord('${d.id}')">${DEL_SVG}</button>
          </div></td>
        </tr>`).join('');
  }
};

/* ── Finance Products (renamed to avoid collision with mgmt products) ── */
const FinProducts = {
  KEY: 'products', sortKey: 'date', sortDir: 'desc', editId: null,
  getData() { return Utils.lsGet(this.KEY); },
  saveData(d) { Utils.lsSet(this.KEY, d); },

  openForm(record = null) {
    this.editId = record ? record.id : null;
    const form = document.getElementById('productForm');
    document.getElementById('prod-modalTitle').textContent = record ? 'Edit Product Expense' : 'Add Product Expense';
    if (record) { form.productName.value = record.productName || ''; form.itemName.value = record.itemName || ''; form.quantity.value = record.quantity || ''; form.cost.value = record.cost || ''; form.date.value = record.date || ''; }
    else { form.reset(); form.date.value = Utils.today(); }

    // Populate supplier dropdown from Management module suppliers (shared localStorage)
    FinProducts.refreshSupplierDropdown(record ? record.supplier || '' : '');

    FU.openModal('productModal'); form.productName.focus();
  },

  refreshSupplierDropdown(currentValue = '') {
    const sel = document.getElementById('fin-supplier-select');
    const customInput = document.getElementById('fin-supplier-custom');
    if (!sel) return;

    // Read suppliers from Management module (uses MGMT_KEY prefix)
    const mgmtSuppliers = Utils.getData('suppliers'); // returns vavh_studio_v3_suppliers
    sel.innerHTML = '<option value="">— Select supplier —</option>';
    mgmtSuppliers.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.company;
      opt.textContent = s.company + (s.name ? ` (${s.name})` : '');
      sel.appendChild(opt);
    });

    // Try to match existing value to dropdown; fall back to custom input
    if (currentValue) {
      const match = mgmtSuppliers.find(s => s.company === currentValue);
      if (match) {
        sel.value = currentValue;
        if (customInput) customInput.value = '';
      } else {
        sel.value = '';
        if (customInput) customInput.value = currentValue;
      }
    } else {
      if (customInput) customInput.value = '';
    }
  },

  getSupplierValue() {
    // Prefer dropdown selection; fall back to custom text input
    const sel = document.getElementById('fin-supplier-select');
    const custom = document.getElementById('fin-supplier-custom');
    if (sel && sel.value) return sel.value;
    if (custom && custom.value.trim()) return custom.value.trim();
    return '';
  },

  openQuickSupplier() {
    // Inline quick-create supplier modal that saves to Management module
    const overlay = document.createElement('div');
    overlay.id = 'fin-quick-supplier-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:14px;padding:28px;width:380px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,0.25);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <h3 style="font-size:16px;font-weight:600;color:#0f1117;">Add New Supplier</h3>
          <button onclick="document.getElementById('fin-quick-supplier-overlay').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#6b7280;">&times;</button>
        </div>
        <label style="display:block;font-size:12px;font-weight:500;color:#6b7280;margin-bottom:5px;">Company Name *</label>
        <input type="text" id="fqs-company" class="form-control" placeholder="e.g. Dhaka Fabric House" style="margin-bottom:10px;">
        <label style="display:block;font-size:12px;font-weight:500;color:#6b7280;margin-bottom:5px;">Contact Person</label>
        <input type="text" id="fqs-name" class="form-control" placeholder="Contact name" style="margin-bottom:10px;">
        <label style="display:block;font-size:12px;font-weight:500;color:#6b7280;margin-bottom:5px;">Phone</label>
        <input type="text" id="fqs-phone" class="form-control" placeholder="Phone number" style="margin-bottom:18px;">
        <div style="display:flex;gap:10px;">
          <button onclick="FinProducts.saveQuickSupplier()" style="flex:1;padding:10px;background:#5b6af5;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:Poppins,sans-serif;font-weight:500;">Save &amp; Select</button>
          <button onclick="document.getElementById('fin-quick-supplier-overlay').remove()" style="flex:1;padding:10px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;cursor:pointer;font-family:Poppins,sans-serif;">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('fqs-company').focus();
  },

  saveQuickSupplier() {
    const company = (document.getElementById('fqs-company').value || '').trim();
    const name = (document.getElementById('fqs-name').value || '').trim();
    const number = (document.getElementById('fqs-phone').value || '').trim();
    if (!company) { FU.toast('Company name is required.', 'error'); return; }

    const suppliers = Utils.getData('suppliers');
    if (suppliers.find(s => s.company.toLowerCase() === company.toLowerCase())) {
      FU.toast('Supplier already exists!', 'error'); return;
    }

    const newSupplier = { id: Utils.uid(), company, name: name || '—', number: number || '—', designation: '', address: '', comments: '' };
    suppliers.push(newSupplier);
    Utils.saveData('suppliers', suppliers);

    document.getElementById('fin-quick-supplier-overlay').remove();
    FU.toast('Supplier added and selected!', 'success');

    // Refresh dropdown and pre-select the new supplier
    FinProducts.refreshSupplierDropdown(company);
  },

  saveRecord() {
    const form = document.getElementById('productForm');
    const rec = { id: this.editId || Utils.uid(), productName: form.productName.value.trim(), itemName: form.itemName.value.trim(), supplier: FinProducts.getSupplierValue(), quantity: parseFloat(form.quantity.value) || 0, cost: parseFloat(form.cost.value) || 0, date: form.date.value };
    if (!rec.productName || !rec.itemName || !rec.cost || !rec.date) { FU.toast('Please fill in all required fields.', 'error'); return; }
    let data = this.getData();
    if (this.editId) { data = data.map(d => d.id === this.editId ? rec : d); FU.toast('Updated!', 'success'); }
    else { data.push(rec); FU.toast('Product expense added!', 'success'); }
    this.saveData(data); FU.closeModal('productModal'); this.render(); SheetsSync.autoSync('products');
  },

  editById(id) { const r = this.getData().find(d => d.id === id); if (r) this.openForm(r); },
  deleteRecord(id) {
    const data = this.getData(), item = data.find(d => d.id === id);
    if (!item || !Utils.confirmDelete(item.productName)) return;
    this.saveData(data.filter(d => d.id !== id)); FU.toast('Deleted.', 'info'); this.render(); SheetsSync.autoSync('products');
  },

  render() {
    const all = this.getData(), total = Utils.sumBy(all, 'cost');
    document.getElementById('prod-totalCount').textContent = all.length + ' records';
    document.getElementById('prod-totalAmount').textContent = Utils.formatCurrency(total);
    const totals = {};
    all.forEach(d => { totals[d.productName] = (totals[d.productName] || 0) + (parseFloat(d.cost) || 0); });
    const se = document.getElementById('productSummary');
    if (se) se.innerHTML = Object.keys(totals).length === 0
      ? '<p style="font-size:13px;color:var(--text-muted)">Product totals will appear here.</p>'
      : Object.entries(totals).map(([n, v]) => `<span class="product-total-badge" style="margin:3px">${Utils.esc(n)}: ${Utils.formatCurrency(v)}</span>`).join('');

    let data = [...all];
    const s = document.getElementById('prod-search')?.value.toLowerCase() || '';
    if (s) data = data.filter(d => d.productName?.toLowerCase().includes(s) || d.itemName?.toLowerCase().includes(s) || d.supplier?.toLowerCase().includes(s));
    data = Utils.sortTable(data, this.sortKey, this.sortDir);
    document.getElementById('prod-tableBody').innerHTML = data.length === 0
      ? `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📦</div><p>No product expenses found.</p></div></td></tr>`
      : data.map(d => `<tr>
          <td>
            <span class="fw-600">${Utils.esc(d.productName)}</span>
            ${d._mgmtProductId ? '<span class="badge badge-blue" style="margin-left:6px;font-size:10px;" title="Auto-synced from Management → Products">🔗 Synced</span>' : ''}
          </td>
          <td>${Utils.esc(d.itemName)}</td>
          <td class="td-muted">${Utils.esc(d.supplier || '—')}</td>
          <td>${d.quantity || '—'}</td>
          <td><span class="currency color-warning">${Utils.formatCurrency(d.cost)}</span></td>
          <td class="td-muted">${Utils.formatDate(d.date)}</td>
          <td><div class="td-actions">
            <button class="btn btn-sm btn-sec btn-icon" onclick="FinProducts.editById('${d.id}')" title="Edit">${EDIT_SVG}</button>
            <button class="btn btn-sm btn-del btn-icon" onclick="FinProducts.deleteRecord('${d.id}')" title="Delete">${DEL_SVG}</button>
          </div></td>
        </tr>`).join('');
  }
};

/* ── Marketing ── */
const Marketing = {
  KEY: 'marketing', sortKey: 'date', sortDir: 'desc', editId: null,
  getData() { return Utils.lsGet(this.KEY); },
  saveData(d) { Utils.lsSet(this.KEY, d); },

  openForm(record = null) {
    this.editId = record ? record.id : null;
    const form = document.getElementById('marketingForm');
    document.getElementById('mkt-modalTitle').textContent = record ? 'Edit Marketing Record' : 'Add Marketing / Ad Cost';
    if (record) { form.platform.value = record.platform || 'Facebook'; form.campaignName.value = record.campaignName || ''; form.amount.value = record.amount || ''; form.date.value = record.date || ''; form.transactionId.value = record.transactionId || ''; form.notes.value = record.notes || ''; }
    else { form.reset(); form.date.value = Utils.today(); }
    FU.openModal('marketingModal'); form.platform.focus();
  },

  saveRecord() {
    const form = document.getElementById('marketingForm');
    const rec = { id: this.editId || Utils.uid(), platform: form.platform.value, campaignName: form.campaignName.value.trim(), amount: parseFloat(form.amount.value) || 0, date: form.date.value, transactionId: form.transactionId.value.trim(), notes: form.notes.value.trim() };
    if (!rec.platform || !rec.amount || !rec.date) { FU.toast('Please fill in all required fields.', 'error'); return; }
    let data = this.getData();
    if (this.editId) { data = data.map(d => d.id === this.editId ? rec : d); FU.toast('Updated!', 'success'); }
    else { data.push(rec); FU.toast('Campaign added!', 'success'); }
    this.saveData(data); FU.closeModal('marketingModal'); this.render(); SheetsSync.autoSync('marketing');
  },

  editById(id) { const r = this.getData().find(d => d.id === id); if (r) this.openForm(r); },
  deleteRecord(id) {
    const data = this.getData(), item = data.find(d => d.id === id);
    if (!item || !Utils.confirmDelete(item.campaignName || item.platform)) return;
    this.saveData(data.filter(d => d.id !== id)); FU.toast('Deleted.', 'info'); this.render(); SheetsSync.autoSync('marketing');
  },

  render() {
    const all = this.getData(), total = Utils.sumBy(all, 'amount');
    document.getElementById('mkt-totalCount').textContent = all.length + ' records';
    document.getElementById('mkt-totalAmount').textContent = Utils.formatCurrency(total);
    const pt = {};
    all.forEach(d => { pt[d.platform] = (pt[d.platform] || 0) + (parseFloat(d.amount) || 0); });
    const pe = document.getElementById('platformSummary');
    if (pe) pe.innerHTML = Object.keys(pt).length === 0
      ? '<p style="font-size:13px;color:var(--text-muted)">Platform spending will appear here.</p>'
      : Object.entries(pt).map(([p, v]) => `<span class="badge ${Utils.platformBadge(p)}" style="margin:3px">${Utils.esc(p)}: ${Utils.formatCurrency(v)}</span>`).join('');

    let data = [...all];
    const s = document.getElementById('mkt-search')?.value.toLowerCase() || '';
    if (s) data = data.filter(d => d.platform?.toLowerCase().includes(s) || d.campaignName?.toLowerCase().includes(s) || d.transactionId?.toLowerCase().includes(s));
    data = Utils.sortTable(data, this.sortKey, this.sortDir);
    document.getElementById('mkt-tableBody').innerHTML = data.length === 0
      ? `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📢</div><p>No marketing records found.</p></div></td></tr>`
      : data.map(d => `<tr>
          <td><span class="badge ${Utils.platformBadge(d.platform)}">${Utils.esc(d.platform)}</span></td>
          <td><span class="fw-600">${Utils.esc(d.campaignName || '—')}</span></td>
          <td><span class="currency color-accent">${Utils.formatCurrency(d.amount)}</span></td>
          <td class="td-muted">${Utils.formatDate(d.date)}</td>
          <td class="td-muted">${Utils.esc(d.transactionId || '—')}</td>
          <td class="td-muted">${Utils.esc(Utils.truncate(d.notes || '—', 30))}</td>
          <td><div class="td-actions">
            <button class="btn btn-sm btn-sec btn-icon" onclick="Marketing.editById('${d.id}')">${EDIT_SVG}</button>
            <button class="btn btn-sm btn-del btn-icon" onclick="Marketing.deleteRecord('${d.id}')">${DEL_SVG}</button>
          </div></td>
        </tr>`).join('');
  }
};

/* ── Reports ── */
function renderReports() {
  const inv = Utils.lsGet('investments');
  const exp = Utils.lsGet('expenses');
  const prod = Utils.lsGet('products');
  const mkt = Utils.lsGet('marketing');
  const orders = Utils.getData('orders');
  const ds = Utils.lsGet('vavh_dealer_supplier');
  const { tI, tE, tP, tM, tOR, balance } = BalanceEngine.computeAuto();

  const fmt = v => Utils.formatCurrency(v);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  // Final summary
  const totalExpenses = tE + tP + tM;
  const completedOrders = orders.filter(o => o.status === 'Completed');
  const totalPaid = orders.reduce((s, o) => s + (parseFloat(o.duePaid) || 0), 0);
  const totalDue = orders.reduce((s, o) => s + (parseFloat(o.dueRemaining) || 0), 0);
  const invStats = Inventory.computeStats();

  set('rep-total-inv', fmt(tI));
  set('rep-total-exp', fmt(totalExpenses));
  set('rep-total-orders', orders.length);
  set('rep-total-manufactured', invStats.totalManufactured + ' units');
  set('rep-total-paid', fmt(totalPaid));
  set('rep-total-due', fmt(totalDue));
  set('rep-final-balance', fmt(BalanceEngine.getCurrent()));
  set('rep-inv-count', inv.length + ' records');
  set('rep-inv-total', fmt(tI));
  set('rep-exp-count', exp.length + ' records');
  set('rep-exp-total', fmt(tE));
  set('rep-prod-count', prod.length + ' records');
  set('rep-prod-total', fmt(tP));
  set('rep-mkt-count', mkt.length + ' records');
  set('rep-mkt-total', fmt(tM));
  set('rep-ord-count', orders.length + ' records');
  set('rep-ord-total', fmt(completedOrders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0)));
  set('rep-ds-count', ds.length + ' records');
  set('rep-ds-total', fmt(Utils.sumBy(ds, 'amount')));

  // Investment table
  const invBody = document.getElementById('rep-inv-body');
  if (invBody) invBody.innerHTML = inv.length === 0
    ? `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💼</div><p>No investments.</p></div></td></tr>`
    : inv.map(r => `<tr><td class="fw-600">${Utils.esc(r.investorName)}</td><td><span class="currency color-success">${fmt(r.amount)}</span></td><td class="td-muted">${Utils.formatDate(r.date)}</td><td><span class="badge ${Utils.paymentBadge(r.method)}">${Utils.esc(r.method)}</span></td><td class="td-muted">${Utils.esc(r.notes || '—')}</td></tr>`).join('');

  // Expense table
  const expBody = document.getElementById('rep-exp-body');
  if (expBody) expBody.innerHTML = exp.length === 0
    ? `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📋</div><p>No expenses.</p></div></td></tr>`
    : exp.map(r => `<tr><td class="fw-600">${Utils.esc(r.employeeName)}</td><td><span class="currency color-danger">${fmt(r.amount)}</span></td><td class="td-muted">${Utils.formatDate(r.date)}</td><td class="td-muted">${Utils.esc(r.reason || '—')}</td></tr>`).join('');

  // Product cost table
  const prodBody = document.getElementById('rep-prod-body');
  if (prodBody) prodBody.innerHTML = prod.length === 0
    ? `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📦</div><p>No product costs.</p></div></td></tr>`
    : prod.map(r => `<tr><td>${Utils.esc(r.itemName || '—')}</td><td class="fw-600">${Utils.esc(r.productName)}</td><td><span class="currency color-warning">${fmt(r.cost)}</span></td><td class="td-muted">${Utils.formatDate(r.date)}</td><td class="td-muted">${Utils.esc(r.supplier || '—')}</td></tr>`).join('');

  // Marketing table
  const mktBody = document.getElementById('rep-mkt-body');
  if (mktBody) mktBody.innerHTML = mkt.length === 0
    ? `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📢</div><p>No marketing records.</p></div></td></tr>`
    : mkt.map(r => `<tr><td><span class="badge ${Utils.platformBadge(r.platform)}">${Utils.esc(r.platform)}</span>${r.campaignName ? ` <span class="td-muted" style="font-size:12px">${Utils.esc(r.campaignName)}</span>` : ''}</td><td><span class="currency color-accent">${fmt(r.amount)}</span></td><td class="td-muted">${Utils.formatDate(r.date)}</td><td class="td-muted">${Utils.esc(r.notes || '—')}</td></tr>`).join('');

  // Order details table
  const ordBody = document.getElementById('rep-ord-body');
  if (ordBody) ordBody.innerHTML = orders.length === 0
    ? `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🛒</div><p>No orders.</p></div></td></tr>`
    : orders.map(o => {
      const statusColor = o.status === 'Completed' ? 'badge-green' : o.status === 'Cancelled' ? 'badge-red' : 'badge-yellow';
      return `<tr>
          <td><span class="badge badge-blue">${Utils.esc(o.id)}</span></td>
          <td>${Utils.esc(o.productName || '—')} <span class="badge badge-gray">×${o.qty || 1}</span></td>
          <td class="fw-600">${Utils.esc(o.customerName || '—')}</td>
          <td><span class="currency fw-600">${fmt(parseFloat(o.total) || 0)}</span></td>
          <td class="td-muted">${Utils.formatDate(o.createdAt)}</td>
          <td><span style="color:${parseFloat(o.dueRemaining) > 0 ? '#d97706' : '#16a34a'};font-weight:600;">${fmt(parseFloat(o.dueRemaining) || 0)}</span></td>
          <td><span class="badge ${statusColor}">${Utils.esc(o.status)}</span></td>
          <td class="td-muted" style="font-size:12px">${Utils.esc(o.notes || '—')}</td>
        </tr>`;
    }).join('');

  // Dealer / supplier table
  const dsBody = document.getElementById('rep-ds-body');
  if (dsBody) dsBody.innerHTML = ds.length === 0
    ? `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🤝</div><p>No supplier records.</p></div></td></tr>`
    : ds.map(r => {
      const dueAmt = Math.max(0, (parseFloat(r.amount) || 0) - (parseFloat(r.paid) || 0));
      const statusBadge = r.status === 'Settled' ? 'badge-green' : r.status === 'Partially Paid' ? 'badge-yellow' : 'badge-red';
      return `<tr>
          <td class="fw-600">${Utils.esc(r.supplierName)}</td>
          <td>${Utils.esc(r.product || '—')}</td>
          <td><span class="currency color-danger">${fmt(parseFloat(r.amount) || 0)}</span></td>
          <td class="td-muted">${Utils.formatDate(r.date)}</td>
          <td><span style="font-weight:600;color:${dueAmt > 0 ? '#d97706' : '#16a34a'}">${fmt(dueAmt)}</span></td>
          <td><span class="badge ${statusBadge}">${Utils.esc(r.status || 'Pending')}</span></td>
          <td class="td-muted" style="font-size:12px">${Utils.esc(r.note || '—')}</td>
        </tr>`;
    }).join('');

  // Report page Charts
  if (typeof Chart !== 'undefined') {
    const totalExpenses = tE + tP + tM;
    // Bar chart — full overview
    const repBarCtx = document.getElementById('rep-bar-chart');
    if (repBarCtx) {
      if (repBarCtx._chartInstance) repBarCtx._chartInstance.destroy();
      repBarCtx._chartInstance = new Chart(repBarCtx, {
        type: 'bar',
        data: {
          labels: ['Total Investment', 'Order Revenue', 'Business Expenses', 'Product Costs', 'Marketing', 'Net Balance'],
          datasets: [{
            label: 'BDT Amount',
            data: [tI, tOR, tE, tP, tM, BalanceEngine.getCurrent()],
            backgroundColor: ['#22c55e', '#5b6af5', '#ef4444', '#f59e0b', '#06b6d4', BalanceEngine.getCurrent() >= 0 ? '#16a34a' : '#dc2626'],
            borderRadius: 7, borderSkipped: false,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' BDT ' + Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 2 }) } } },
          scales: { y: { ticks: { callback: v => 'BDT ' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) }, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } }
        }
      });
    }
    // Pie chart — spending distribution
    const repPieCtx = document.getElementById('rep-pie-chart');
    if (repPieCtx) {
      if (repPieCtx._chartInstance) repPieCtx._chartInstance.destroy();
      repPieCtx._chartInstance = new Chart(repPieCtx, {
        type: 'pie',
        data: {
          labels: ['Business Expenses', 'Product Costs', 'Marketing & Ads'],
          datasets: [{ data: [tE, tP, tM], backgroundColor: ['#ef4444', '#f59e0b', '#06b6d4'], borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { position: 'bottom', labels: { padding: 14, font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => ' BDT ' + Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' (' + (ctx.raw / (tE + tP + tM || 1) * 100).toFixed(1) + '%)' } } }
        }
      });
    }
  }
}

function clearSection(key, label) {
  if (confirm(`Delete all ${label} data? This cannot be undone.`)) {
    localStorage.removeItem(key); FU.toast(`${label} cleared.`, 'info'); renderReports();
  }
}
function clearAllFinance() {
  if (confirm('Delete ALL financial data? This is permanent!')) {
    ['investments', 'expenses', 'products', 'marketing', 'vavh_dealer_supplier', 'vavh_inventory_log', 'vavh_inventory_adjustments', 'vavh_manual_balance'].forEach(k => localStorage.removeItem(k));
    FU.toast('All financial data cleared.', 'info'); renderReports();
  }
}

/* ── User Management (finance module) ── */
const UserMgmt = {
  editId: null,

  openCreate() {
    this.editId = null;
    document.getElementById('userModalTitle').textContent = 'Create New User';
    document.getElementById('uFormSubmitBtn').textContent = 'Create User';
    document.getElementById('uFormName').value = '';
    document.getElementById('uFormUsername').value = '';
    document.getElementById('uFormPassword').value = '';
    document.getElementById('uFormPassword').placeholder = 'Min 6 characters';
    document.getElementById('uFormRole').value = 'user';
    document.getElementById('uFormNotes').value = '';
    FU.openModal('userModal');
    document.getElementById('uFormName').focus();
  },

  openEdit(user) {
    this.editId = user.id;
    document.getElementById('userModalTitle').textContent = 'Edit User';
    document.getElementById('uFormSubmitBtn').textContent = 'Save Changes';
    document.getElementById('uFormName').value = user.name || '';
    document.getElementById('uFormUsername').value = user.username || '';
    document.getElementById('uFormPassword').value = '';
    document.getElementById('uFormPassword').placeholder = 'Leave blank to keep current';
    document.getElementById('uFormRole').value = user.role || 'user';
    document.getElementById('uFormNotes').value = user.notes || user.designation || '';
    FU.openModal('userModal');
  },

  editById(id) { const u = Auth.getUsers().find(u => u.id === id); if (u) this.openEdit(u); },

  save() {
    FU.toast('User management requires the authenticated server connection.', 'error');
  },

  deleteUser(id) {
    if (currentUser && currentUser.id === id) { FU.toast('You cannot delete your own account.', 'error'); return; }
    const users = Auth.getUsers();
    const user = users.find(u => u.id === id);
    if (!user) return;
    if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;
    Auth.saveUsers(users.filter(u => u.id !== id));
    FU.toast('User deleted.', 'info');
    this.render();
  },

  render() {
    const users = Auth.getUsers();
    const current = currentUser;
    document.getElementById('um-totalUsers').textContent = users.length;
    document.getElementById('um-totalAdmins').textContent = users.filter(u => u.role === 'admin').length;
    document.getElementById('um-totalStandard').textContent = users.filter(u => u.role === 'user').length;
    const container = document.getElementById('userListContainer');
    if (!container) return;
    container.innerHTML = users.map(u => {
      const isMe = current && current.id === u.id;
      const isAdmin = u.role === 'admin';
      return `<div class="admin-user-card">
        <div class="admin-avatar">${(u.name || u.username)[0].toUpperCase()}</div>
        <div class="admin-user-info">
          <div class="admin-user-name">${Utils.esc(u.name)} ${isMe ? '<span class="badge badge-blue" style="font-size:10px">You</span>' : ''}</div>
          <div class="admin-user-meta">@${Utils.esc(u.username)}${u.notes ? ' · ' + Utils.esc(u.notes) : ''} · Created ${Utils.formatDate(u.createdAt)}</div>
        </div>
        <span class="role-badge ${isAdmin ? 'admin' : 'user'}" style="margin-right:12px">${isAdmin ? 'Admin' : 'User'}</span>
        <div class="td-actions">
          <button class="btn btn-sm btn-sec btn-icon" onclick="UserMgmt.editById('${u.id}')">${EDIT_SVG}</button>
          ${!isMe ? `<button class="btn btn-sm btn-del btn-icon" onclick="UserMgmt.deleteUser('${u.id}')">${DEL_SVG}</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }
};

/* ── Settings ── */
function loadSettings() {
  const s = SheetsSync.getSettings();
  if (s.spreadsheetId) document.getElementById('spreadsheetId').value = s.spreadsheetId;
  if (s.accessToken) document.getElementById('accessToken').value = s.accessToken;
  document.getElementById('autoSyncToggle').checked = !!s.autoSync;
  const lt = document.getElementById('lastSyncTime'); if (lt) lt.textContent = s.lastSync ? new Date(s.lastSync).toLocaleString() : 'Never';
  if (s.spreadsheetId) { const l = document.getElementById('sheetLink'); if (l) l.href = `https://docs.google.com/spreadsheets/d/${s.spreadsheetId}/edit`; }
  if (s.sheetTitle) { const sn = document.getElementById('sheetName'); if (sn) sn.textContent = s.sheetTitle; }
  updateStatusCard(s.connected, s.sheetTitle);
  SheetsSync.updateSyncUI();
}
function updateStatusCard(connected, title) {
  const t = document.getElementById('statusText'), m = document.getElementById('statusMeta'), c = document.getElementById('statusCard');
  if (connected) { if (t) t.textContent = 'Connected'; if (m) m.textContent = title || 'Google Sheets'; if (c) c.style.borderTop = '3px solid var(--success)'; }
  else { if (t) t.textContent = 'Not Connected'; if (m) m.textContent = 'Configure below'; if (c) c.style.borderTop = ''; }
}
async function testConnection() {
  const id = document.getElementById('spreadsheetId').value.trim();
  const token = document.getElementById('accessToken').value.trim();
  const el = document.getElementById('tokenStatus');
  if (!id || !token) { el.className = 'token-status bad'; el.textContent = ' Please enter both fields.'; return; }
  SheetsSync.saveSettings({ ...SheetsSync.getSettings(), spreadsheetId: id, accessToken: token });
  el.className = 'token-status none'; el.textContent = '⏳ Testing…';
  try {
    const title = await SheetsSync.testConnection();
    el.className = 'token-status ok'; el.textContent = ` Connected! Sheet: "${title}"`;
    const s = SheetsSync.getSettings(); s.sheetTitle = title; s.connected = true; SheetsSync.saveSettings(s);
    updateStatusCard(true, title);
  } catch (err) { el.className = 'token-status bad'; el.textContent = ` ${err.message}`; updateStatusCard(false); }
}
function saveCredentials() {
  const id = document.getElementById('spreadsheetId').value.trim(), token = document.getElementById('accessToken').value.trim();
  if (!id || !token) { FU.toast('Please fill both fields.', 'error'); return; }
  SheetsSync.saveSettings({ ...SheetsSync.getSettings(), spreadsheetId: id, accessToken: token });
  FU.toast('Settings saved!', 'success');
}
function clearCredentials() {
  if (!confirm('Clear Google Sheets credentials?')) return;
  SheetsSync.saveSettings({});
  document.getElementById('spreadsheetId').value = ''; document.getElementById('accessToken').value = '';
  document.getElementById('tokenStatus').className = 'token-status none'; document.getElementById('tokenStatus').textContent = ' Not tested yet';
  updateStatusCard(false); FU.toast('Credentials cleared.', 'info');
}
function toggleAutoSync(cb) { const s = SheetsSync.getSettings(); s.autoSync = cb.checked; SheetsSync.saveSettings(s); FU.toast(cb.checked ? 'Auto-sync enabled!' : 'Auto-sync disabled.', 'info'); }
async function manualSync() {
  if (!SheetsSync.isConfigured()) { FU.toast('Please configure Google Sheets credentials first.', 'error'); return; }
  const btn = document.getElementById('btnSyncNow'); if (btn) { btn.textContent = '⏳ Syncing…'; btn.disabled = true; }
  await SheetsSync.syncAll(true);
  if (btn) { btn.innerHTML = '<i class="fas fa-sync"></i> Sync Now'; btn.disabled = false; }
  loadSettings();
}

/* ── Order Revenue (synced from Management) ── */
const OrderRevenue = {
  getOrders() {
    return Utils.getData('orders').filter(o => o.status === 'Completed');
  },

  render() {
    const orders = this.getOrders();
    const query = (document.getElementById('or-search')?.value || '').toLowerCase();
    const filtered = query
      ? orders.filter(o =>
        (o.id || '').toLowerCase().includes(query) ||
        (o.customerName || '').toLowerCase().includes(query) ||
        (o.productName || '').toLowerCase().includes(query)
      )
      : orders;

    const total = orders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    const avg = orders.length ? total / orders.length : 0;
    const now = new Date();
    const monthOrders = orders.filter(o => {
      const d = new Date(o.completedAt || o.updatedAt || o.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthTotal = monthOrders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);

    // Stat cards
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('or-totalRevenue', Utils.formatCurrency(total));
    set('or-totalCount', 'From ' + orders.length + ' order' + (orders.length !== 1 ? 's' : ''));
    set('or-monthRevenue', Utils.formatCurrency(monthTotal));
    set('or-monthCount', monthOrders.length + ' order' + (monthOrders.length !== 1 ? 's' : ''));
    set('or-avgRevenue', Utils.formatCurrency(avg));
    set('or-recordCount', filtered.length + ' records');
    set('or-totalAmt', Utils.formatCurrency(total));

    const tbody = document.getElementById('or-tableBody');
    if (!tbody) return;
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🛍️</div><p>${query ? 'No matching orders.' : 'No completed orders yet. Mark orders as Completed in Management → Orders.'}</p></div></td></tr>`;
      return;
    }

    const sorted = [...filtered].sort((a, b) => new Date(b.completedAt || b.updatedAt || b.createdAt) - new Date(a.completedAt || a.updatedAt || a.createdAt));
    tbody.innerHTML = sorted.map(o => {
      const dateStr = Utils.formatDate(o.completedAt || o.updatedAt || o.createdAt);
      return `<tr>
        <td><span class="badge badge-green">${Utils.esc(o.id)}</span></td>
        <td class="fw-600">${Utils.esc(o.customerName || '—')}</td>
        <td>${Utils.esc(o.productName || '—')}</td>
        <td><span class="badge badge-blue">×${o.qty || 1}</span></td>
        <td><span class="currency fw-600 color-success">+${Utils.formatCurrency(parseFloat(o.total) || 0)}</span></td>
        <td class="td-muted">${dateStr}</td>
        <td style="color:var(--text-muted);font-size:12px;">${Utils.esc(o.notes || '—')}</td>
      </tr>`;
    }).join('');
  },

  exportCSV() {
    const orders = this.getOrders();
    if (!orders.length) { FU.toast('No completed orders to export.', 'error'); return; }
    const headers = ['Order ID', 'Customer', 'Product', 'Qty', 'Revenue', 'Completed On', 'Notes'];
    const rows = orders.map(o => [
      o.id, o.customerName, o.productName, o.qty,
      o.total,
      o.completedAt || o.updatedAt || o.createdAt,
      o.notes || ''
    ]);
    let csv = headers.join(',') + '\n';
    rows.forEach(r => { csv += r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',') + '\n'; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `order_revenue_${Utils.today()}.csv`; a.click();
    URL.revokeObjectURL(url);
    FU.toast('Order revenue exported!', 'success');
  }
};

/* ── Due Tracker ── */
const DueTracker = {
  KEY: 'vavh_due_records',
  editId: null,

  getStandalone() { return Utils.lsGet(this.KEY); },
  saveStandalone(data) { Utils.lsSet(this.KEY, data); },

  getAllRecords() {
    const orderRecs = Utils.getData('orders')
      .filter(o => o.financeNameDue && o.financeNameDue.trim() !== '')
      .map(o => ({
        _type: 'order',
        id: o.id,
        partyName: o.customerName || '—',
        description: (o.productName || '') + (o.qty ? ' ×' + o.qty : ''),
        financeNameDue: o.financeNameDue,
        dueTotal: parseFloat(o.dueTotal) || parseFloat(o.total) || 0,
        duePaid: parseFloat(o.duePaid) || 0,
        dueRemaining: parseFloat(o.dueRemaining) >= 0
          ? parseFloat(o.dueRemaining)
          : Math.max(0, (parseFloat(o.dueTotal) || parseFloat(o.total) || 0) - (parseFloat(o.duePaid) || 0)),
        dueStatus: o.status || 'Pending',
        createdAt: o.createdAt,
        notes: o.notes || ''
      }));
    const standalone = this.getStandalone().map(r => ({ _type: 'standalone', ...r }));
    return [...orderRecs, ...standalone].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  _colors(fin) {
    if (fin.includes('Customer will pay')) return { finColor: '#155e75', finBg: 'rgba(6,182,212,0.13)', amtColor: '#0e7490', amtSign: '+' };
    else if (fin.includes('Dealer will pay')) return { finColor: '#92400e', finBg: 'rgba(245,158,11,0.13)', amtColor: '#b45309', amtSign: '+' };
    else if (fin.includes('pay customer')) return { finColor: '#991b1b', finBg: 'rgba(239,68,68,0.13)', amtColor: '#b91c1c', amtSign: '−' };
    else if (fin.includes('pay dealer')) return { finColor: '#166534', finBg: 'rgba(34,197,94,0.13)', amtColor: '#15803d', amtSign: '−' };
    return { finColor: '#6b7280', finBg: 'rgba(107,114,128,0.1)', amtColor: '#374151', amtSign: '' };
  },

  _statusStyle(s) {
    if (s === 'Settled') return { color: '#166534', bg: 'rgba(34,197,94,0.15)' };
    if (s === 'Partially Paid') return { color: '#92400e', bg: 'rgba(245,158,11,0.15)' };
    if (s === 'Completed') return { color: '#166534', bg: 'rgba(34,197,94,0.15)' };
    if (s === 'Cancelled') return { color: '#991b1b', bg: 'rgba(239,68,68,0.15)' };
    return { color: '#92400e', bg: 'rgba(245,158,11,0.15)' };
  },

  render() {
    const all = this.getAllRecords();
    const query = (document.getElementById('due-search')?.value || '').toLowerCase();
    const typeF = document.getElementById('due-filter-type')?.value || '';
    const statusF = document.getElementById('due-filter-status')?.value || '';

    const filtered = all.filter(r => {
      const matchQ = !query ||
        (r.id || '').toLowerCase().includes(query) ||
        (r.partyName || '').toLowerCase().includes(query) ||
        (r.description || '').toLowerCase().includes(query);
      const matchT = !typeF || (r.financeNameDue || '').includes(typeF);
      const matchS = !statusF || (r.dueStatus || '').includes(statusF);
      return matchQ && matchT && matchS;
    });

    const sumRem = cat => all.filter(r => (r.financeNameDue || '').includes(cat))
      .reduce((s, r) => s + (parseFloat(r.dueRemaining) || 0), 0);
    const cnt = cat => all.filter(r => (r.financeNameDue || '').includes(cat)).length;

    const custPay = sumRem('Customer will pay');
    const dealerPay = sumRem('Dealer will pay');
    const oweCust = sumRem('pay customer');
    const oweDealer = sumRem('pay dealer');
    const net = (custPay + dealerPay) - (oweCust + oweDealer);

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('due-stat-cust-pay', Utils.formatCurrency(custPay));
    set('due-stat-cust-pay-count', cnt('Customer will pay') + ' records');
    set('due-stat-dealer-pay', Utils.formatCurrency(dealerPay));
    set('due-stat-dealer-pay-count', cnt('Dealer will pay') + ' records');
    set('due-stat-i-owe-cust', Utils.formatCurrency(oweCust));
    set('due-stat-i-owe-cust-count', cnt('pay customer') + ' records');
    set('due-stat-i-owe-dealer', Utils.formatCurrency(oweDealer));
    set('due-stat-i-owe-dealer-count', cnt('pay dealer') + ' records');
    set('due-stat-net', Utils.formatCurrency(Math.abs(net)));
    const netEl = document.getElementById('due-stat-net');
    if (netEl) {
      netEl.style.color = net >= 0 ? '#6d28d9' : '#b91c1c';
      const netMeta = netEl.closest('.fin-stat-card')?.querySelector('.card-meta');
      if (netMeta) netMeta.textContent = net >= 0 ? 'You are owed (net remaining)' : 'You owe (net remaining)';
    }
    set('due-record-count', filtered.length + ' record' + (filtered.length !== 1 ? 's' : ''));

    const tbody = document.getElementById('due-tableBody');
    if (!tbody) return;
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">💰</div><p>${query || typeF || statusF ? 'No matching records.' : 'No due records yet. Create one or assign Finance Name Due when creating orders.'}</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(r => {
      const fin = r.financeNameDue || '—';
      const c = this._colors(fin);
      const ss = this._statusStyle(r.dueStatus || 'Pending');
      const dueTotal = parseFloat(r.dueTotal) || 0;
      const duePaid = parseFloat(r.duePaid) || 0;
      const dueRem = parseFloat(r.dueRemaining) || 0;
      const paidPct = dueTotal > 0 ? Math.min(100, Math.round(duePaid / dueTotal * 100)) : 0;
      const isOrder = r._type === 'order';
      const dateStr = Utils.formatDate(r.createdAt);
      const editBtn = isOrder
        ? `<button class="btn btn-sm btn-sec btn-icon" style="opacity:.45;cursor:not-allowed;" disabled title="Edit in Management → Orders">${EDIT_SVG}</button>`
        : `<button class="btn btn-sm btn-sec btn-icon" onclick="DueTracker.openEdit('${r.id}')" title="Edit">${EDIT_SVG}</button>`;
      const delBtn = isOrder ? ''
        : `<button class="btn btn-sm btn-del btn-icon" onclick="DueTracker.deleteRecord('${r.id}')" title="Delete">${DEL_SVG}</button>`;

      return `<tr>
        <td>
          <span class="badge ${isOrder ? 'badge-green' : 'badge-blue'}">${Utils.esc(r.id)}</span>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${isOrder ? 'Order' : 'Manual'}</div>
        </td>
        <td class="fw-600">${Utils.esc(r.partyName)}</td>
        <td style="max-width:150px;font-size:13px;">${Utils.esc(r.description || '—')}</td>
        <td><span style="font-weight:700;color:${c.amtColor};">${c.amtSign}${Utils.formatCurrency(dueTotal)}</span></td>
        <td>
          <span style="color:#166534;font-weight:600;">${Utils.formatCurrency(duePaid)}</span>
          <div style="height:4px;background:#e5e7eb;border-radius:4px;margin-top:3px;width:64px;">
            <div style="height:100%;width:${paidPct}%;background:#22c55e;border-radius:4px;"></div>
          </div>
        </td>
        <td><span style="font-weight:700;color:${dueRem === 0 ? '#166534' : '#d97706'};">${Utils.formatCurrency(dueRem)}</span></td>
        <td><span style="background:${c.finBg};color:${c.finColor};padding:3px 8px;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap;">${Utils.esc(fin)}</span></td>
        <td><span style="background:${ss.bg};color:${ss.color};padding:3px 8px;border-radius:10px;font-size:11px;font-weight:500;">${Utils.esc(r.dueStatus || 'Pending')}</span></td>
        <td class="td-muted" style="font-size:12px;">${dateStr}</td>
        <td><div class="td-actions">${editBtn}${delBtn}</div></td>
      </tr>`;
    }).join('');
  },

  openCreateModal() {
    this.editId = null;
    const form = document.getElementById('dueForm');
    if (form) form.reset();
    const dateEl = document.getElementById('due-modal-date');
    if (dateEl) dateEl.value = Utils.today();
    document.getElementById('due-modal-title').textContent = 'Create Due Record';
    const summary = document.getElementById('due-modal-summary');
    if (summary) summary.style.display = 'none';
    FU.openModal('dueModal');
    setTimeout(() => document.getElementById('due-party-name')?.focus(), 60);
  },

  openEdit(id) {
    const rec = this.getStandalone().find(r => r.id === id);
    if (!rec) return;
    this.editId = id;
    document.getElementById('due-modal-title').textContent = 'Edit Due Record';
    const form = document.getElementById('dueForm');
    form.partyName.value = rec.partyName || '';
    form.description.value = rec.description || '';
    form.financeNameDue.value = rec.financeNameDue || '';
    form.dueTotal.value = rec.dueTotal || '';
    form.duePaid.value = rec.duePaid || 0;
    form.dueDate.value = rec.dueDate || Utils.today();
    form.dueStatus.value = rec.dueStatus || 'Pending';
    form.notes.value = rec.notes || '';
    this.updateModalCalc();
    FU.openModal('dueModal');
  },

  updateModalCalc() {
    const total = parseFloat(document.getElementById('due-modal-total')?.value) || 0;
    const paid = parseFloat(document.getElementById('due-modal-paid')?.value) || 0;
    const rem = Math.max(0, total - paid);
    const summary = document.getElementById('due-modal-summary');
    if (!summary) return;
    summary.style.display = 'flex';
    const fmt = v => 'BDT ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('due-modal-sum-total').textContent = fmt(total);
    document.getElementById('due-modal-sum-paid').textContent = fmt(paid);
    const remEl = document.getElementById('due-modal-sum-remaining');
    if (remEl) { remEl.textContent = fmt(rem); remEl.style.color = rem === 0 ? '#16a34a' : '#d97706'; }
    const statusSel = document.getElementById('dueForm')?.dueStatus;
    if (statusSel) {
      if (rem === 0 && total > 0) statusSel.value = 'Settled';
      else if (paid > 0 && rem > 0) statusSel.value = 'Partially Paid';
      else statusSel.value = 'Pending';
    }
  },

  saveRecord() {
    const form = document.getElementById('dueForm');
    const partyName = form.partyName.value.trim();
    const financeNameDue = form.financeNameDue.value;
    const dueTotal = parseFloat(form.dueTotal.value) || 0;
    const duePaid = parseFloat(form.duePaid.value) || 0;
    const dueDate = form.dueDate.value;
    if (!partyName) { FU.toast('Party name is required.', 'error'); return; }
    if (!financeNameDue) { FU.toast('Please select a finance due type.', 'error'); return; }
    if (!dueTotal) { FU.toast('Total due amount is required.', 'error'); return; }
    if (!dueDate) { FU.toast('Date is required.', 'error'); return; }
    const rec = {
      id: this.editId || ('DUE' + Date.now()),
      partyName,
      description: form.description.value.trim(),
      financeNameDue,
      dueTotal: dueTotal.toFixed(2),
      duePaid: duePaid.toFixed(2),
      dueRemaining: Math.max(0, dueTotal - duePaid).toFixed(2),
      dueDate,
      dueStatus: form.dueStatus.value || 'Pending',
      notes: form.notes.value.trim(),
      createdAt: this.editId
        ? (this.getStandalone().find(r => r.id === this.editId)?.createdAt || new Date().toISOString())
        : new Date().toISOString()
    };
    let data = this.getStandalone();
    if (this.editId) {
      data = data.map(r => r.id === this.editId ? rec : r);
      FU.toast('Due record updated!', 'success');
    } else {
      data.push(rec);
      FU.toast('Due record created!', 'success');
    }
    this.saveStandalone(data);
    this.editId = null;
    FU.closeModal('dueModal');
    this.render();
  },

  deleteRecord(id) {
    if (!confirm('Delete this due record? This cannot be undone.')) return;
    this.saveStandalone(this.getStandalone().filter(r => r.id !== id));
    FU.toast('Deleted.', 'info');
    this.render();
  },

  exportCSV() {
    const records = this.getAllRecords();
    if (!records.length) { FU.toast('No due records to export.', 'error'); return; }
    const headers = ['ID', 'Type', 'Party', 'Description', 'Finance Due', 'Total Due', 'Paid', 'Remaining', 'Status', 'Date'];
    let csv = headers.join(',') + '\n';
    records.forEach(r => {
      const row = [r.id, r._type, r.partyName, r.description || '', r.financeNameDue || '',
      r.dueTotal, r.duePaid, r.dueRemaining, r.dueStatus || '', r.createdAt || ''];
      csv += row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `due_tracker_${Utils.today()}.csv`; a.click();
    URL.revokeObjectURL(url);
    FU.toast('Due records exported!', 'success');
  }
};

/* ── CSV Exporter ── */
const Exporter = {
  toCSV(data, cols) {
    if (!data || data.length === 0) return '';
    const h = cols.map(c => `"${c.label}"`).join(',');
    const rows = data.map(r => cols.map(c => { let v = r[c.key] !== undefined ? r[c.key] : ''; v = String(v).replace(/"/g, '""'); return `"${v}"`; }).join(','));
    return [h, ...rows].join('\r\n');
  },
  download(csv, filename) {
    if (!csv) { FU.toast('No data to export.', 'error'); return; }
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename || 'export.csv'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    FU.toast(`Exported ${filename}`, 'success');
  },
  exportInvestments() { this.download(this.toCSV(Utils.lsGet('investments'), [{ key: 'investorName', label: 'Investor Name' }, { key: 'amount', label: 'Amount' }, { key: 'date', label: 'Date' }, { key: 'method', label: 'Payment Method' }, { key: 'notes', label: 'Notes' }]), 'investments.csv'); },
  exportExpenses() { this.download(this.toCSV(Utils.lsGet('expenses'), [{ key: 'employeeName', label: 'Employee Name' }, { key: 'amount', label: 'Amount' }, { key: 'date', label: 'Date' }, { key: 'reason', label: 'Reason' }, { key: 'attachment', label: 'Attachment' }]), 'business_expenses.csv'); },
  exportProducts() { this.download(this.toCSV(Utils.lsGet('products'), [{ key: 'productName', label: 'Product Name' }, { key: 'itemName', label: 'Item/Material' }, { key: 'supplier', label: 'Supplier' }, { key: 'quantity', label: 'Quantity' }, { key: 'cost', label: 'Cost' }, { key: 'date', label: 'Date' }]), 'product_expenses.csv'); },
  exportMarketing() { this.download(this.toCSV(Utils.lsGet('marketing'), [{ key: 'platform', label: 'Platform' }, { key: 'campaignName', label: 'Campaign' }, { key: 'amount', label: 'Amount' }, { key: 'date', label: 'Date' }, { key: 'transactionId', label: 'Transaction ID' }, { key: 'notes', label: 'Notes' }]), 'marketing_costs.csv'); },
  exportAll() {
    const inv = Utils.lsGet('investments'), exp = Utils.lsGet('expenses'), prod = Utils.lsGet('products'), mkt = Utils.lsGet('marketing');
    let csv = '=== INVESTMENTS ===\r\n' + (this.toCSV(inv, [{ key: 'investorName', label: 'Investor Name' }, { key: 'amount', label: 'Amount' }, { key: 'date', label: 'Date' }, { key: 'method', label: 'Payment Method' }, { key: 'notes', label: 'Notes' }]) || '"No data"');
    csv += '\r\n\r\n=== BUSINESS EXPENSES ===\r\n' + (this.toCSV(exp, [{ key: 'employeeName', label: 'Employee Name' }, { key: 'amount', label: 'Amount' }, { key: 'date', label: 'Date' }, { key: 'reason', label: 'Reason' }, { key: 'attachment', label: 'Attachment' }]) || '"No data"');
    csv += '\r\n\r\n=== PRODUCT EXPENSES ===\r\n' + (this.toCSV(prod, [{ key: 'productName', label: 'Product Name' }, { key: 'itemName', label: 'Item/Material' }, { key: 'supplier', label: 'Supplier' }, { key: 'quantity', label: 'Quantity' }, { key: 'cost', label: 'Cost' }, { key: 'date', label: 'Date' }]) || '"No data"');
    csv += '\r\n\r\n=== MARKETING & AD COSTS ===\r\n' + (this.toCSV(mkt, [{ key: 'platform', label: 'Platform' }, { key: 'campaignName', label: 'Campaign' }, { key: 'amount', label: 'Amount' }, { key: 'date', label: 'Date' }, { key: 'transactionId', label: 'Transaction ID' }, { key: 'notes', label: 'Notes' }]) || '"No data"');
    this.download(csv, 'vavh_finance_full_export.csv');
  },

  exportPDF() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const inv = Utils.lsGet('investments');
    const exp = Utils.lsGet('expenses');
    const prod = Utils.lsGet('products');
    const mkt = Utils.lsGet('marketing');
    const orders = Utils.getData('orders');
    const ds = Utils.lsGet('vavh_dealer_supplier');

    const { tI, tE, tP, tM, tOR } = BalanceEngine.computeAuto();
    const finalBalance = BalanceEngine.getCurrent();
    const isManual = BalanceEngine.hasManual();
    const completedOrders = orders.filter(o => o.status === 'Completed');
    const totalPaid = orders.reduce((s, o) => s + (parseFloat(o.duePaid) || 0), 0);
    const totalDue = orders.reduce((s, o) => s + (parseFloat(o.dueRemaining) || 0), 0);
    const invStats = getSharedDashboardData().invStats;

    const fmt = v => 'BDT ' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const netColor = finalBalance >= 0 ? '#16a34a' : '#dc2626';

    function tableRows(data, cols) {
      if (!data.length) return `<tr><td colspan="${cols.length}" style="color:#9ca3af;font-style:italic;padding:8px 10px;">No records</td></tr>`;
      return data.map(r => `<tr>${cols.map(c => `<td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;">${Utils.esc(c.fn ? c.fn(r) : (r[c.key] || '—'))}</td>`).join('')}</tr>`).join('');
    }

    // ── Inline SVG chart helpers for PDF ──
    function makeSVGBar(items, width, height) {
      // items: [{label, value, color}]
      const maxVal = Math.max(...items.map(i => Math.abs(i.value)), 1);
      const bw = Math.floor((width - 60) / items.length) - 8;
      const barAreaH = height - 50;
      let svgBars = '', svgLabels = '', svgVals = '';
      items.forEach((item, idx) => {
        const x = 50 + idx * ((width - 60) / items.length) + 4;
        const bh = Math.max(4, Math.round((Math.abs(item.value) / maxVal) * barAreaH));
        const y = 10 + barAreaH - bh;
        const shortK = v => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0);
        svgBars += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${item.color}" opacity="0.88"/>`;
        svgVals += `<text x="${x + bw / 2}" y="${y - 4}" text-anchor="middle" font-size="8" fill="#374151" font-weight="600">${shortK(Math.abs(item.value))}</text>`;
        const lbl = item.label.length > 9 ? item.label.slice(0, 8) + '…' : item.label;
        svgLabels += `<text x="${x + bw / 2}" y="${height - 8}" text-anchor="middle" font-size="8" fill="#6b7280">${lbl}</text>`;
      });
      // Y-axis ticks
      let yTicks = '';
      for (let i = 0; i <= 4; i++) {
        const yPos = 10 + (barAreaH * (1 - i / 4));
        const val = (maxVal * i / 4);
        const shortK = v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0);
        yTicks += `<line x1="48" y1="${yPos}" x2="${width}" y2="${yPos}" stroke="#e5e7eb" stroke-width="0.5"/>`;
        yTicks += `<text x="44" y="${yPos + 3}" text-anchor="end" font-size="7" fill="#9ca3af">${shortK(val)}</text>`;
      }
      return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family:Arial,sans-serif">${yTicks}${svgBars}${svgVals}${svgLabels}</svg>`;
    }

    function makeSVGDonut(items, size) {
      const total = items.reduce((s, i) => s + Math.abs(i.value), 0) || 1;
      const cx = size / 2, cy = size / 2 - 10, r = size / 2 - 28, ri = r * 0.58;
      let arcs = '', legends = '', angle = -Math.PI / 2;
      items.forEach((item, idx) => {
        const frac = Math.abs(item.value) / total;
        const a1 = angle, a2 = angle + frac * 2 * Math.PI;
        const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
        const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
        const xi1 = cx + ri * Math.cos(a2), yi1 = cy + ri * Math.sin(a2);
        const xi2 = cx + ri * Math.cos(a1), yi2 = cy + ri * Math.sin(a1);
        const lg = frac > 0.5 ? 1 : 0;
        arcs += `<path d="M${x1},${y1} A${r},${r} 0 ${lg},1 ${x2},${y2} L${xi1},${yi1} A${ri},${ri} 0 ${lg},0 ${xi2},${yi2} Z" fill="${item.color}" opacity="0.88"/>`;
        const ly = size - 22 + idx * 12;
        const pct = (frac * 100).toFixed(1);
        const shortK = v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0);
        legends += `<rect x="4" y="${ly}" width="8" height="8" rx="2" fill="${item.color}"/><text x="16" y="${ly + 7}" font-size="8" fill="#374151">${item.label}: ${shortK(Math.abs(item.value))} (${pct}%)</text>`;
        angle = a2;
      });
      // center label
      const balText = total >= 1000000 ? (total / 1000000).toFixed(1) + 'M' : total >= 1000 ? (total / 1000).toFixed(0) + 'k' : total.toFixed(0);
      const centerLabel = `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="9" fill="#6b7280">Total</text><text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="11" font-weight="700" fill="#0f1117">${balText}</text>`;
      return `<svg width="${size}" height="${size + items.length * 12}" xmlns="http://www.w3.org/2000/svg" style="font-family:Arial,sans-serif">${arcs}${centerLabel}${legends}</svg>`;
    }

    const pdfBarChart = makeSVGBar([
      { label: 'Investment', value: tI, color: '#22c55e' },
      { label: 'Order Rev.', value: tOR, color: '#5b6af5' },
      { label: 'Biz Exp.', value: tE, color: '#ef4444' },
      { label: 'Product', value: tP, color: '#f59e0b' },
      { label: 'Marketing', value: tM, color: '#06b6d4' },
      { label: 'Balance', value: Math.max(0, finalBalance), color: finalBalance >= 0 ? '#16a34a' : '#dc2626' },
    ], 420, 160);

    const pdfDonutChart = makeSVGDonut([
      { label: 'Business Exp.', value: tE, color: '#ef4444' },
      { label: 'Product Costs', value: tP, color: '#f59e0b' },
      { label: 'Marketing', value: tM, color: '#06b6d4' },
    ], 200);

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>V.A.V.H Studio — Financial Report</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#0f1117; background:#fff; padding:32px 40px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #5b6af5; padding-bottom:16px; margin-bottom:20px; }
  .brand h1 { font-size:22px; font-weight:700; color:#0f1117; } .brand .sub { font-size:12px; color:#5b6af5; font-weight:600; margin-top:2px; }
  .meta { font-size:11px; color:#6b7280; text-align:right; line-height:1.9; }
  .section-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#5b6af5; margin:18px 0 8px; border-left:3px solid #5b6af5; padding-left:8px; }
  .summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
  .card { border-radius:8px; padding:12px 14px; border-left:4px solid; }
  .card.inv  { background:#f0fdf4; border-color:#22c55e; }
  .card.exp  { background:#fef2f2; border-color:#ef4444; }
  .card.prod { background:#fffbeb; border-color:#f59e0b; }
  .card.mkt  { background:#ecfeff; border-color:#06b6d4; }
  .card.rev  { background:#f0fdf4; border-color:#16a34a; }
  .card-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#6b7280; margin-bottom:4px; }
  .card-amount { font-size:14px; font-weight:700; color:#0f1117; } .card-count { font-size:10px; color:#9ca3af; margin-top:2px; }
  .balance-box { background:#0f1117; border-radius:10px; padding:14px 20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
  .balance-box .lbl { font-size:10px; color:rgba(255,255,255,0.5); margin-bottom:3px; } .balance-box .val { font-size:13px; font-weight:700; color:#fff; }
  .net-val { font-size:18px; font-weight:800; color:${netColor}; }
  table { width:100%; border-collapse:collapse; margin-bottom:4px; font-size:11px; }
  th { background:#f8f9fb; font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; padding:7px 10px; text-align:left; border-bottom:2px solid #e5e7eb; }
  .footer { margin-top:24px; padding-top:10px; border-top:1px solid #e5e7eb; font-size:10px; color:#9ca3af; display:flex; justify-content:space-between; }
  .stats-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
  .stat-pill { background:#f8f9fb; border:1px solid #e5e7eb; border-radius:20px; padding:5px 14px; font-size:11px; font-weight:600; }
  @media print { body { padding:16px 24px; } }
</style></head><body>
<div class="header">
  <div class="brand"><h1>V.A.V.H Studio</h1><div class="sub">Full Financial Summary Report</div></div>
  <div class="meta"><strong>${dateStr}</strong><br>${timeStr}<br><span style="color:#9ca3af;font-size:10px;">Auto-generated · V.A.V.H Platform</span></div>
</div>

<div class="section-title">Financial Overview</div>
<div class="summary-grid">
  <div class="card inv"><div class="card-label">Total Investment</div><div class="card-amount">${fmt(tI)}</div><div class="card-count">${inv.length} record${inv.length !== 1 ? 's' : ''}</div></div>
  <div class="card exp"><div class="card-label">Business Expenses</div><div class="card-amount">${fmt(tE)}</div><div class="card-count">${exp.length} record${exp.length !== 1 ? 's' : ''}</div></div>
  <div class="card prod"><div class="card-label">Product Costs</div><div class="card-amount">${fmt(tP)}</div><div class="card-count">${prod.length} record${prod.length !== 1 ? 's' : ''}</div></div>
  <div class="card mkt"><div class="card-label">Marketing & Ads</div><div class="card-amount">${fmt(tM)}</div><div class="card-count">${mkt.length} record${mkt.length !== 1 ? 's' : ''}</div></div>
</div>
<div class="stats-row">
  <span class="stat-pill">📦 Orders: ${orders.length} total · ${completedOrders.length} completed</span>
  <span class="stat-pill">🛍️ Order Revenue: ${fmt(tOR)}</span>
  <span class="stat-pill">🏭 Manufactured: ${invStats.totalManufactured} units</span>
  <span class="stat-pill">📉 Total Due: ${fmt(totalDue)}</span>
</div>
<div class="balance-box">
  <div><div class="lbl">Total Outgoing (Expenses)</div><div class="val">${fmt(tE + tP + tM)}</div></div>
  <div style="text-align:center"><div class="lbl">Order Revenue</div><div class="val">+${fmt(tOR)}</div></div>
  <div style="text-align:right"><div class="lbl">Final Current Balance${isManual ? ' (Manually Adjusted)' : ''}</div><div class="net-val">${fmt(finalBalance)}</div></div>
</div>

<div class="section-title">📊 Financial Charts</div>
<div style="display:flex;gap:24px;align-items:flex-start;margin-bottom:18px;page-break-inside:avoid;">
  <div style="flex:1;">
    <div style="font-size:9px;font-weight:700;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Income vs Expenses Overview</div>
    ${pdfBarChart}
  </div>
  <div style="width:220px;flex-shrink:0;">
    <div style="font-size:9px;font-weight:700;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Spending Distribution</div>
    ${pdfDonutChart}
  </div>
</div>

<div class="section-title">🔹 Total Investment</div>
<table><thead><tr><th>Investor Name</th><th>Amount</th><th>Date</th><th>Method</th><th>Note</th></tr></thead>
<tbody>${tableRows(inv, [{ key: 'investorName' }, { fn: r => fmt(r.amount) }, { fn: r => fmtDate(r.date) }, { key: 'method' }, { key: 'notes' }])}</tbody></table>

<div class="section-title">🔹 Business Expenses</div>
<table><thead><tr><th>Employee</th><th>Amount</th><th>Date</th><th>Note / Reason</th></tr></thead>
<tbody>${tableRows(exp, [{ key: 'employeeName' }, { fn: r => fmt(r.amount) }, { fn: r => fmtDate(r.date) }, { key: 'reason' }])}</tbody></table>

<div class="section-title">🔹 Product Costs</div>
<table><thead><tr><th>Items / Material</th><th>Product</th><th>Amount</th><th>Date</th><th>Supplier</th></tr></thead>
<tbody>${tableRows(prod, [{ key: 'itemName' }, { key: 'productName' }, { fn: r => fmt(r.cost) }, { fn: r => fmtDate(r.date) }, { key: 'supplier' }])}</tbody></table>

<div class="section-title">🔹 Marketing & Ads</div>
<table><thead><tr><th>Platform / Campaign</th><th>Amount</th><th>Date</th><th>Note</th></tr></thead>
<tbody>${tableRows(mkt, [{ fn: r => (r.platform || '') + (r.campaignName ? ' / ' + r.campaignName : '') }, { fn: r => fmt(r.amount) }, { fn: r => fmtDate(r.date) }, { key: 'notes' }])}</tbody></table>

<div class="section-title">🔹 Order Details</div>
<table><thead><tr><th>Order ID</th><th>Item</th><th>Customer</th><th>Amount</th><th>Date</th><th>Due</th><th>Status</th></tr></thead>
<tbody>${tableRows(orders, [{ key: 'id' }, { fn: r => (r.productName || '') + (r.qty ? ' ×' + r.qty : '') }, { key: 'customerName' }, { fn: r => fmt(r.total || 0) }, { fn: r => fmtDate(r.createdAt) }, { fn: r => fmt(parseFloat(r.dueRemaining) || 0) }, { key: 'status' }])}</tbody></table>

<div class="section-title">🔹 Dealer / Supplier Details</div>
<table><thead><tr><th>Supplier / Dealer</th><th>Product</th><th>Amount</th><th>Date</th><th>Due</th><th>Status</th><th>Note</th></tr></thead>
<tbody>${tableRows(ds, [{ key: 'supplierName' }, { key: 'product' }, { fn: r => fmt(r.amount || 0) }, { fn: r => fmtDate(r.date) }, { fn: r => fmt(Math.max(0, (r.amount || 0) - (r.paid || 0))) }, { key: 'status' }, { key: 'note' }])}</tbody></table>

<div class="section-title">📊 Final Summary</div>
<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
  <tr><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-weight:600;">Total Investment</td><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;color:#16a34a;font-weight:700;">${fmt(tI)}</td></tr>
  <tr><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-weight:600;">Total Expenses (Business + Product + Marketing)</td><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;color:#dc2626;font-weight:700;">${fmt(tE + tP + tM)}</td></tr>
  <tr><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-weight:600;">Total Order Count</td><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-weight:700;">${orders.length} (${completedOrders.length} completed)</td></tr>
  <tr><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-weight:600;">Total Products Manufactured</td><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-weight:700;">${invStats.totalManufactured} units</td></tr>
  <tr><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-weight:600;">Total Paid Amount (Orders)</td><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;color:#16a34a;font-weight:700;">${fmt(totalPaid)}</td></tr>
  <tr><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-weight:600;">Total Due Amount (Orders)</td><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;color:#d97706;font-weight:700;">${fmt(totalDue)}</td></tr>
  <tr style="background:#f0fdf4;"><td style="padding:8px 10px;font-weight:700;font-size:13px;">Final Current Balance${isManual ? ' (Manual Override)' : ''}</td><td style="padding:8px 10px;font-weight:800;font-size:15px;color:${netColor};">${fmt(finalBalance)}</td></tr>
</tbody></table>

<div class="footer">
  <span>V.A.V.H Studio · Confidential Financial Report</span>
  <span>${dateStr} · ${timeStr}</span>
</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { FU.toast('Allow popups to generate PDF!', 'error'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    FU.toast('PDF report ready — choose "Save as PDF" in the print dialog', 'success');
  },

  /* ── Excel Report — same data source & sections as PDF ── */
  exportExcel() {
    // Shared data — same function used by PDF
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const inv = Utils.lsGet('investments');
    const exp = Utils.lsGet('expenses');
    const prod = Utils.lsGet('products');
    const mkt = Utils.lsGet('marketing');
    const orders = Utils.getData('orders');
    const ds = Utils.lsGet('vavh_dealer_supplier');

    const { tI, tE, tP, tM, tOR } = BalanceEngine.computeAuto();
    const finalBalance = BalanceEngine.getCurrent();
    const isManual = BalanceEngine.hasManual();
    const completedOrds = orders.filter(o => o.status === 'Completed');
    const totalPaid = orders.reduce((s, o) => s + (parseFloat(o.duePaid) || 0), 0);
    const totalDue = orders.reduce((s, o) => s + (parseFloat(o.dueRemaining) || 0), 0);
    const invStats = Inventory.computeStats();

    const fmt = v => Number(v || 0).toFixed(2);
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    // Helper: build one worksheet as an HTML table (Excel opens HTML tables natively)
    const tbl = (headers, rows) => {
      const hRow = headers.map(h => `<th style="background:#5b6af5;color:#fff;font-weight:700;padding:6px 10px;border:1px solid #ccc;">${h}</th>`).join('');
      const dRows = rows.map((r, i) => {
        const bg = i % 2 === 0 ? '#f8f9fb' : '#ffffff';
        return `<tr>${r.map(c => `<td style="padding:5px 10px;border:1px solid #e5e7eb;background:${bg};">${c ?? ''}</td>`).join('')}</tr>`;
      }).join('');
      return `<table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:12px;font-family:Arial,sans-serif;margin-bottom:20px;">\n<thead><tr>${hRow}</tr></thead>\n<tbody>${dRows}</tbody></table>`;
    };

    // Section header row
    const sec = (title, color) => `<tr><td colspan="10" style="background:${color};color:#fff;font-weight:700;padding:7px 10px;font-size:13px;border:1px solid ${color};">${title}</td></tr>`;

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>V.A.V.H Financial Report</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head><body>
<table cellspacing="0" cellpadding="0" border="0" style="font-family:Arial,sans-serif;font-size:13px;margin-bottom:16px;">
  <tr><td style="font-size:20px;font-weight:700;color:#0f1117;padding:4px 0;">V.A.V.H Studio — Financial Report</td></tr>
  <tr><td style="color:#5b6af5;font-weight:600;">Full Financial Summary</td></tr>
  <tr><td style="color:#6b7280;font-size:11px;">Generated: ${dateStr} · ${timeStr}${isManual ? ' · Balance: Manually Adjusted' : ''}</td></tr>
</table>

<table cellspacing="0" cellpadding="0" border="0" style="font-family:Arial,sans-serif;font-size:12px;margin-bottom:20px;border-collapse:collapse;">
  <tr>
    <td style="background:#f0fdf4;border-left:4px solid #22c55e;padding:10px 16px;min-width:160px;"><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Total Investment</div><div style="font-size:16px;font-weight:700;color:#16a34a;">BDT ${fmt(tI)}</div><div style="font-size:10px;color:#9ca3af;">${inv.length} records</div></td>
    <td style="width:10px;"></td>
    <td style="background:#fef2f2;border-left:4px solid #ef4444;padding:10px 16px;min-width:160px;"><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Business Expenses</div><div style="font-size:16px;font-weight:700;color:#dc2626;">BDT ${fmt(tE)}</div><div style="font-size:10px;color:#9ca3af;">${exp.length} records</div></td>
    <td style="width:10px;"></td>
    <td style="background:#fffbeb;border-left:4px solid #f59e0b;padding:10px 16px;min-width:160px;"><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Product Costs</div><div style="font-size:16px;font-weight:700;color:#d97706;">BDT ${fmt(tP)}</div><div style="font-size:10px;color:#9ca3af;">${prod.length} records</div></td>
    <td style="width:10px;"></td>
    <td style="background:#ecfeff;border-left:4px solid #06b6d4;padding:10px 16px;min-width:160px;"><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Marketing &amp; Ads</div><div style="font-size:16px;font-weight:700;color:#0e7490;">BDT ${fmt(tM)}</div><div style="font-size:10px;color:#9ca3af;">${mkt.length} records</div></td>
    <td style="width:10px;"></td>
    <td style="background:#f0fdf4;border-left:4px solid #16a34a;padding:10px 16px;min-width:160px;"><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Order Revenue</div><div style="font-size:16px;font-weight:700;color:#15803d;">BDT ${fmt(tOR)}</div><div style="font-size:10px;color:#9ca3af;">${completedOrds.length} completed</div></td>
  </tr>
</table>

<table cellspacing="0" cellpadding="0" border="0" style="font-family:Arial,sans-serif;font-size:12px;background:#0f1117;border-radius:8px;padding:14px 20px;margin-bottom:20px;min-width:600px;border-collapse:collapse;">
  <tr>
    <td style="padding:8px 20px;"><div style="color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;margin-bottom:4px;">Total Outgoing</div><div style="color:#fff;font-size:15px;font-weight:700;">BDT ${fmt(tE + tP + tM)}</div></td>
    <td style="color:rgba(255,255,255,0.3);font-size:18px;padding:0 10px;">−</td>
    <td style="padding:8px 20px;"><div style="color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;margin-bottom:4px;">Order Revenue</div><div style="color:#22c55e;font-size:15px;font-weight:700;">+BDT ${fmt(tOR)}</div></td>
    <td style="color:rgba(255,255,255,0.3);font-size:18px;padding:0 10px;">=</td>
    <td style="padding:8px 20px;"><div style="color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;margin-bottom:4px;">Final Balance${isManual ? ' (Manual)' : ''}</div><div style="color:${finalBalance >= 0 ? '#22c55e' : '#ef4444'};font-size:18px;font-weight:800;">BDT ${fmt(finalBalance)}</div></td>
  </tr>
</table>

<p style="font-size:11px;color:#6b7280;margin-bottom:8px;">📦 Manufactured: ${invStats.totalManufactured} units &nbsp;|&nbsp; 📉 Total Due (Orders): BDT ${fmt(totalDue)} &nbsp;|&nbsp; ✅ Total Paid: BDT ${fmt(totalPaid)}</p>

${tbl(['Investor Name', 'Amount (BDT)', 'Date', 'Payment Method', 'Notes'],
      inv.map(r => [r.investorName, fmt(r.amount), fmtDate(r.date), r.method, r.notes || '']))}

${tbl(['Employee', 'Amount (BDT)', 'Date', 'Reason / Note'],
        exp.map(r => [r.employeeName, fmt(r.amount), fmtDate(r.date), r.reason || '']))}

${tbl(['Item / Material', 'Product Name', 'Cost (BDT)', 'Date', 'Supplier'],
          prod.map(r => [r.itemName || '', r.productName || '', fmt(r.cost), fmtDate(r.date), r.supplier || '']))}

${tbl(['Platform / Campaign', 'Amount (BDT)', 'Date', 'Transaction ID', 'Notes'],
            mkt.map(r => [(r.platform || '') + (r.campaignName ? ' / ' + r.campaignName : ''), fmt(r.amount), fmtDate(r.date), r.transactionId || '', r.notes || '']))}

${tbl(['Order ID', 'Customer', 'Product', 'Qty', 'Revenue (BDT)', 'Date', 'Finance Due', 'Due Remaining', 'Status'],
              orders.map(r => [r.id, r.customerName, r.productName, r.qty, fmt(r.total), fmtDate(r.createdAt), r.financeNameDue || '—', fmt(r.dueRemaining || 0), r.status]))}

${ds.length ? tbl(['Supplier / Dealer', 'Product', 'Amount (BDT)', 'Paid (BDT)', 'Due (BDT)', 'Date', 'Status', 'Note'],
                ds.map(r => [r.supplierName, r.product, fmt(r.amount), fmt(r.paid || 0), fmt(Math.max(0, (r.amount || 0) - (r.paid || 0))), fmtDate(r.date), r.status || 'Pending', r.note || ''])) : ''}

${tbl(['Metric', 'Value'], [
                  ['Total Investment', 'BDT ' + fmt(tI)],
                  ['Business Expenses', 'BDT ' + fmt(tE)],
                  ['Product Costs', 'BDT ' + fmt(tP)],
                  ['Marketing & Ads', 'BDT ' + fmt(tM)],
                  ['Total Expenses', 'BDT ' + fmt(tE + tP + tM)],
                  ['Total Orders', orders.length + ' (' + completedOrds.length + ' completed)'],
                  ['Products Manufactured', invStats.totalManufactured + ' units'],
                  ['Products Sold', invStats.totalSold + ' units'],
                  ['Products In Stock', invStats.totalStock + ' units'],
                  ['Order Revenue', 'BDT ' + fmt(tOR)],
                  ['Total Paid (Orders)', 'BDT ' + fmt(totalPaid)],
                  ['Total Due (Orders)', 'BDT ' + fmt(totalDue)],
                  ['Final Current Balance' + (isManual ? ' (Manual Override)' : ''), 'BDT ' + fmt(finalBalance)]
                ])}

</body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VAVH_Financial_Report_${Utils.today()}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    FU.toast('Excel report downloaded!', 'success');
  }
};

/* =====================================================================
   INVENTORY MANAGEMENT MODULE
   ===================================================================== */
const Inventory = {
  LOG_KEY: 'vavh_inventory_log',
  ADJUST_KEY: 'vavh_inventory_adjustments',

  getLog() { return Utils.lsGet(this.LOG_KEY); },
  saveLog(d) { Utils.lsSet(this.LOG_KEY, d); },
  getAdjustments() { return Utils.lsGet(this.ADJUST_KEY); },
  saveAdjustments(d) { Utils.lsSet(this.ADJUST_KEY, d); },

  /* Compute per-product stock: base stock from Management + manual adjustments - sold from orders */
  computeStats() {
    const mgmtProducts = Utils.getData('products');
    const orders = Utils.getData('orders');
    const adjustments = this.getAdjustments();

    // Count sold qty per product name from ALL non-cancelled orders
    const soldByProduct = {};
    orders.forEach(o => {
      if (o.status !== 'Cancelled') {
        soldByProduct[o.productName] = (soldByProduct[o.productName] || 0) + (parseInt(o.qty) || 0);
      }
    });

    // Aggregate adjustments per product id: add-types vs subtract-types
    const addByProduct = {};      // net delta for current stock calculation
    const mfrByProduct = {};      // only manufacture/add adjustments for produced count
    adjustments.forEach(a => {
      const isAdd = (a.adjType === 'manufacture' || a.adjType === 'adjustment_add' || a.adjType === 'return');
      const qty = parseInt(a.qty) || 0;
      const delta = isAdd ? qty : -qty;
      addByProduct[a.productId] = (addByProduct[a.productId] || 0) + delta;
      if (isAdd) mfrByProduct[a.productId] = (mfrByProduct[a.productId] || 0) + qty;
    });

    let totalStock = 0, totalManufactured = 0, totalSold = 0;
    mgmtProducts.forEach(p => {
      const baseStock = parseInt(p.stock) || 0;
      const extraAdj = addByProduct[p.id] || 0;
      const mfrAdj = mfrByProduct[p.id] || 0;
      const currentStock = Math.max(0, baseStock + extraAdj);
      const sold = soldByProduct[p.name] || 0;
      // manufactured = initial stock entered (baseStock) + only manufacture-type additions
      // Do NOT add sold again — baseStock already represents initial produced qty
      const manufactured = baseStock + mfrAdj;
      totalStock += currentStock;
      totalSold += sold;
      totalManufactured += manufactured;
    });

    const unsold = totalStock;
    return { totalStock, totalManufactured, totalSold, unsold };
  },

  render() {
    const mgmtProducts = Utils.getData('products');
    const orders = Utils.getData('orders');
    const adjustments = this.getAdjustments();
    const log = this.getLog();
    const query = (document.getElementById('inv-page-search')?.value || '').toLowerCase();

    // Aggregate sold per product name
    const soldByProduct = {};
    orders.forEach(o => {
      if (o.status !== 'Cancelled') {
        soldByProduct[o.productName] = (soldByProduct[o.productName] || 0) + (parseInt(o.qty) || 0);
      }
    });

    // Aggregate manual adjustments per product id
    const adjByProduct = {};
    adjustments.forEach(a => {
      const isAdd = (a.adjType === 'manufacture' || a.adjType === 'adjustment_add' || a.adjType === 'return');
      const qty = parseInt(a.qty) || 0;
      const delta = isAdd ? qty : -qty;
      if (!adjByProduct[a.productId]) adjByProduct[a.productId] = { delta: 0, mfrAdj: 0, list: [] };
      adjByProduct[a.productId].delta += delta;
      if (isAdd) adjByProduct[a.productId].mfrAdj += qty;
      adjByProduct[a.productId].list.push(a);
    });

    let totalStock = 0, totalManufactured = 0, totalSold = 0;
    let rows = mgmtProducts.map(p => {
      const baseStock = parseInt(p.stock) || 0;
      const extraAdj = adjByProduct[p.id]?.delta || 0;
      const mfrAdj = adjByProduct[p.id]?.mfrAdj || 0;
      const currentStock = Math.max(0, baseStock + extraAdj);
      const sold = soldByProduct[p.name] || 0;
      // manufactured = initial stock + only manufacture/add adjustments (no double-count with sold)
      const manufactured = baseStock + mfrAdj;
      const adjList = adjByProduct[p.id]?.list || [];

      totalStock += currentStock;
      totalManufactured += manufactured;
      totalSold += sold;

      return { p, currentStock, sold, manufactured, adjList };
    });

    if (query) rows = rows.filter(r => r.p.name?.toLowerCase().includes(query) || r.p.sku?.toLowerCase().includes(query));

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('inv-stat-products', mgmtProducts.length);
    set('inv-stat-total', totalStock + ' units');
    set('inv-stat-manufactured', totalManufactured + ' units');
    set('inv-stat-sold', totalSold + ' units');

    const tbody = document.getElementById('inv-tableBody');
    if (tbody) tbody.innerHTML = rows.length === 0
      ? `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📦</div><p>No products found.</p></div></td></tr>`
      : rows.map(({ p, currentStock, sold, manufactured, adjList }) => {
        const stockColor = currentStock < 5 ? '#ef4444' : currentStock < 10 ? '#f59e0b' : '#16a34a';
        const statusBadge = currentStock === 0 ? '<span class="badge badge-red">Out of Stock</span>' : currentStock < 5 ? '<span class="badge badge-yellow">Low Stock</span>' : '<span class="badge badge-green">In Stock</span>';
        const adjSummary = adjList.length > 0 ? adjList.slice(-3).map(a => {
          const sign = (a.adjType === 'manufacture' || a.adjType === 'adjustment_add' || a.adjType === 'return') ? '+' : '-';
          return `<span style="font-size:11px;color:${sign === '+' ? '#16a34a' : '#dc2626'}">${sign}${a.qty} (${a.adjType})</span>`;
        }).join(', ') : '<span class="td-muted" style="font-size:12px">—</span>';
        return `<tr>
            <td><span class="fw-600">${Utils.esc(p.name)}</span></td>
            <td class="td-muted">${Utils.esc(p.sku || '—')}</td>
            <td style="color:#7c3aed;font-weight:600;">${manufactured}</td>
            <td style="color:#dc2626;font-weight:600;">${sold}</td>
            <td style="color:${stockColor};font-weight:700;font-size:16px;">${currentStock}</td>
            <td>${statusBadge}</td>
            <td>${adjSummary}</td>
            <td><button class="btn btn-sec btn-sm" onclick="Inventory.openAdjustForm('${p.id}')"><i class="fas fa-edit"></i> Adjust</button></td>
          </tr>`;
      }).join('');

    // Render log
    const logBody = document.getElementById('inv-log-body');
    if (logBody) {
      const sortedLog = [...log].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
      logBody.innerHTML = sortedLog.length === 0
        ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📋</div><p>No stock movements yet.</p></div></td></tr>`
        : sortedLog.map(entry => {
          const isAdd = (entry.adjType === 'manufacture' || entry.adjType === 'adjustment_add' || entry.adjType === 'return');
          const typeLabels = { manufacture: '📦 Manufactured', adjustment_add: '➕ Manual Add', adjustment_sub: '➖ Manual Remove', return: '🔄 Return/Restock', sold: '🛒 Sold (Order)' };
          return `<tr>
              <td class="td-muted">${Utils.formatDate(entry.createdAt)}</td>
              <td class="fw-600">${Utils.esc(entry.productName || '—')}</td>
              <td>${typeLabels[entry.adjType] || Utils.esc(entry.adjType)}</td>
              <td style="font-weight:700;color:${isAdd ? '#16a34a' : '#dc2626'}">${isAdd ? '+' : '-'}${entry.qty}</td>
              <td class="td-muted">${Utils.esc(entry.reference || '—')}</td>
              <td class="td-muted">${Utils.esc(entry.note || '—')}</td>
            </tr>`;
        }).join('');
    }
  },

  openAdjustForm(productId = null) {
    const sel = document.getElementById('inv-form-product');
    if (sel) {
      const mgmtProducts = Utils.getData('products');
      sel.innerHTML = '<option value="">— Select product —</option>' +
        mgmtProducts.map(p => `<option value="${p.id}" ${p.id === productId ? 'selected' : ''}>${Utils.esc(p.name)} (${Utils.esc(p.sku || '—')}) · Stock: ${p.stock}</option>`).join('');
    }
    const dateEl = document.getElementById('inv-form-date');
    if (dateEl) dateEl.value = Utils.today();
    document.getElementById('inventoryForm')?.reset();
    if (sel && productId) sel.value = productId;
    if (dateEl) dateEl.value = Utils.today();
    FU.openModal('inventoryModal');
  },

  saveAdjustment() {
    const form = document.getElementById('inventoryForm');
    if (!form) return;
    const productId = document.getElementById('inv-form-product').value;
    const adjType = form.adjType.value;
    const qty = parseInt(form.qty.value) || 0;
    const date = form.date.value;
    const reference = form.reference.value.trim();
    const note = form.note.value.trim();

    if (!productId) { FU.toast('Please select a product.', 'error'); return; }
    if (!adjType) { FU.toast('Please select adjustment type.', 'error'); return; }
    if (qty <= 0) { FU.toast('Quantity must be greater than 0.', 'error'); return; }

    const mgmtProducts = Utils.getData('products');
    const product = mgmtProducts.find(p => p.id === productId);
    if (!product) { FU.toast('Product not found.', 'error'); return; }

    const adjustment = { id: Utils.uid(), productId, productName: product.name, adjType, qty, date, reference, note, createdAt: new Date().toISOString() };
    const adjustments = this.getAdjustments();
    adjustments.push(adjustment);
    this.saveAdjustments(adjustments);

    // Also add to log
    const logEntry = { ...adjustment };
    const log = this.getLog();
    log.push(logEntry);
    this.saveLog(log);

    FU.closeModal('inventoryModal');
    FU.toast('Stock adjustment saved!', 'success');
    this.render();
  },

  exportCSV() {
    const mgmtProducts = Utils.getData('products');
    const orders = Utils.getData('orders');
    const adjustments = this.getAdjustments();

    const soldByProduct = {};
    orders.forEach(o => { if (o.status !== 'Cancelled') soldByProduct[o.productName] = (soldByProduct[o.productName] || 0) + (parseInt(o.qty) || 0); });
    const adjByProduct = {};
    adjustments.forEach(a => { const d = (a.adjType === 'manufacture' || a.adjType === 'adjustment_add' || a.adjType === 'return') ? (parseInt(a.qty) || 0) : -(parseInt(a.qty) || 0); adjByProduct[a.productId] = (adjByProduct[a.productId] || 0) + d; });

    const headers = ['Product', 'SKU', 'Manufactured', 'Sold', 'Current Stock', 'Status'];
    const rows = mgmtProducts.map(p => {
      const baseStock = parseInt(p.stock) || 0;
      const extra = adjByProduct[p.id] || 0;
      const cur = Math.max(0, baseStock + extra);
      const sold = soldByProduct[p.name] || 0;
      const mfr = cur + sold;
      const status = cur === 0 ? 'Out of Stock' : cur < 5 ? 'Low Stock' : 'In Stock';
      return [p.name, p.sku || '', mfr, sold, cur, status];
    });
    let csv = headers.join(',') + '\n';
    rows.forEach(r => { csv += r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `inventory_${Utils.today()}.csv`; a.click();
    URL.revokeObjectURL(url);
    FU.toast('Inventory exported!', 'success');
  }
};

/* =====================================================================
   DEALER / SUPPLIER MODULE
   ===================================================================== */
const DealerSupplier = {
  KEY: 'vavh_dealer_supplier',
  editId: null,

  getData() { try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch { return []; } },
  saveData(d) { localStorage.setItem(this.KEY, JSON.stringify(d)); },

  openForm(record = null) {
    this.editId = record ? record.id : null;
    document.getElementById('ds-modal-title').textContent = record ? 'Edit Supplier Record' : 'Add Dealer / Supplier Record';
    const form = document.getElementById('dealerSupplierForm');
    if (!form) return;
    if (record) {
      form.supplierName.value = record.supplierName || '';
      form.product.value = record.product || '';
      form.amount.value = record.amount || '';
      form.paid.value = record.paid || 0;
      form.date.value = record.date || '';
      form.status.value = record.status || 'Pending';
      form.note.value = record.note || '';
    } else {
      form.reset();
      form.date.value = Utils.today();
      form.paid.value = 0;
    }
    this.updateCalc();
    FU.openModal('dealerSupplierModal');
    setTimeout(() => form.supplierName.focus(), 60);
  },

  updateCalc() {
    const form = document.getElementById('dealerSupplierForm');
    if (!form) return;
    const total = parseFloat(form.amount?.value) || 0;
    const paid = parseFloat(form.paid?.value) || 0;
    const due = Math.max(0, total - paid);
    const fmt = v => Utils.formatCurrency(v);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('ds-sum-total', fmt(total));
    set('ds-sum-paid', fmt(paid));
    set('ds-sum-due', fmt(due));
  },

  saveRecord() {
    const form = document.getElementById('dealerSupplierForm');
    if (!form) return;
    const rec = {
      id: this.editId || Utils.uid(),
      supplierName: form.supplierName.value.trim(),
      product: form.product.value.trim(),
      amount: parseFloat(form.amount.value) || 0,
      paid: parseFloat(form.paid.value) || 0,
      date: form.date.value,
      status: form.status.value || 'Pending',
      note: form.note.value.trim(),
      createdAt: this.editId ? undefined : new Date().toISOString()
    };
    if (!rec.supplierName || !rec.product || !rec.amount || !rec.date) { FU.toast('Please fill required fields.', 'error'); return; }
    let data = this.getData();
    if (this.editId) {
      data = data.map(d => d.id === this.editId ? { ...d, ...rec } : d);
      FU.toast('Record updated!', 'success');
    } else {
      rec.createdAt = new Date().toISOString();
      data.push(rec);
      FU.toast('Supplier record added!', 'success');
    }
    this.saveData(data);
    FU.closeModal('dealerSupplierModal');
    this.render();
  },

  editById(id) { const r = this.getData().find(d => d.id === id); if (r) this.openForm(r); },

  deleteRecord(id) {
    const data = this.getData(), item = data.find(d => d.id === id);
    if (!item || !Utils.confirmDelete(item.supplierName)) return;
    this.saveData(data.filter(d => d.id !== id));
    FU.toast('Deleted.', 'info');
    this.render();
  },

  render() {
    const all = this.getData();
    const query = (document.getElementById('ds-search')?.value || '').toLowerCase();
    let data = query ? all.filter(r => r.supplierName?.toLowerCase().includes(query) || r.product?.toLowerCase().includes(query)) : all;

    const totalAmt = Utils.sumBy(all, 'amount');
    const totalPaid = Utils.sumBy(all, 'paid');
    const totalDue = all.reduce((s, r) => s + Math.max(0, (parseFloat(r.amount) || 0) - (parseFloat(r.paid) || 0)), 0);
    const fmt = v => Utils.formatCurrency(v);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('ds-stat-total', all.length);
    set('ds-stat-amount', fmt(totalAmt));
    set('ds-stat-paid', fmt(totalPaid));
    set('ds-stat-due', fmt(totalDue));
    set('ds-record-count', data.length + ' records');

    const tbody = document.getElementById('ds-tableBody');
    if (!tbody) return;
    tbody.innerHTML = data.length === 0
      ? `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🤝</div><p>${query ? 'No matching records.' : 'No supplier records yet.'}</p></div></td></tr>`
      : data.map(r => {
        const due = Math.max(0, (parseFloat(r.amount) || 0) - (parseFloat(r.paid) || 0));
        const statusBadge = r.status === 'Settled' ? 'badge-green' : r.status === 'Partially Paid' ? 'badge-yellow' : 'badge-red';
        return `<tr>
            <td class="fw-600">${Utils.esc(r.supplierName)}</td>
            <td>${Utils.esc(r.product || '—')}</td>
            <td><span class="currency color-danger">${fmt(parseFloat(r.amount) || 0)}</span></td>
            <td><span class="currency color-success">${fmt(parseFloat(r.paid) || 0)}</span></td>
            <td><span style="font-weight:700;color:${due > 0 ? '#d97706' : '#16a34a'}">${fmt(due)}</span></td>
            <td class="td-muted">${Utils.formatDate(r.date)}</td>
            <td><span class="badge ${statusBadge}">${Utils.esc(r.status || 'Pending')}</span></td>
            <td class="td-muted" style="font-size:12px">${Utils.esc(r.note || '—')}</td>
            <td><div class="td-actions">
              <button class="btn btn-sm btn-sec btn-icon" onclick="DealerSupplier.editById('${r.id}')">${EDIT_SVG}</button>
              <button class="btn btn-sm btn-del btn-icon" onclick="DealerSupplier.deleteRecord('${r.id}')">${DEL_SVG}</button>
            </div></td>
          </tr>`;
      }).join('');
  },

  exportCSV() {
    const data = this.getData();
    if (!data.length) { FU.toast('No records to export.', 'error'); return; }
    const headers = ['Supplier', 'Product', 'Amount', 'Paid', 'Due', 'Date', 'Status', 'Note'];
    const rows = data.map(r => [r.supplierName, r.product, r.amount, r.paid, Math.max(0, (r.amount || 0) - (r.paid || 0)), r.date, r.status || 'Pending', r.note || '']);
    let csv = headers.join(',') + '\n';
    rows.forEach(row => { csv += row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',') + '\n'; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `dealer_supplier_${Utils.today()}.csv`; a.click();
    URL.revokeObjectURL(url);
    FU.toast('Exported!', 'success');
  }
};

/* ── Google Sheets Sync ── */
const SheetsSync = {
  KEY: 'vavh_sheets_settings',
  getSettings() { try { const r = localStorage.getItem(this.KEY); return r ? JSON.parse(r) : {}; } catch { return {}; } },
  saveSettings(s) { localStorage.setItem(this.KEY, JSON.stringify(s)); },
  isConfigured() { const s = this.getSettings(); return !!(s.spreadsheetId && s.accessToken); },
  getAuth() { const s = this.getSettings(); return { spreadsheetId: s.spreadsheetId, token: s.accessToken }; },

  async apiRequest(method, path, body = null) {
    const { token } = this.getAuth();
    if (!token) throw new Error('No access token. Go to Settings.');
    const opts = { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, opts);
    const data = await res.json();
    if (!res.ok) { if (res.status === 401) throw new Error('Token expired. Please refresh in Settings.'); throw new Error(data?.error?.message || `API error ${res.status}`); }
    return data;
  },

  async ensureSheet(title) {
    const { spreadsheetId } = this.getAuth();
    const info = await this.apiRequest('GET', `/${spreadsheetId}`);
    const ex = info.sheets?.find(s => s.properties.title === title);
    if (ex) return ex.properties.sheetId;
    const res = await this.apiRequest('POST', `/${spreadsheetId}:batchUpdate`, { requests: [{ addSheet: { properties: { title } } }] });
    return res.replies[0].addSheet.properties.sheetId;
  },

  async writeSheet(title, headers, rows) {
    const { spreadsheetId } = this.getAuth();
    await this.ensureSheet(title);
    await this.apiRequest('PUT', `/${spreadsheetId}/values/${encodeURIComponent(title + '!A1')}?valueInputOption=USER_ENTERED`, { values: [headers, ...rows] });
    const sheetId = await this.ensureSheet(title);
    await this.apiRequest('POST', `/${spreadsheetId}:batchUpdate`, { requests: [{ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.357, green: 0.416, blue: 0.961 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } }] }).catch(() => { });
  },

  async syncInvestments() {
    const d = Utils.lsGet('investments');
    const investors = [...new Set(d.map(r => r.investorName).filter(Boolean))];
    const rows = [];
    investors.forEach(name => {
      const entries = d.filter(r => r.investorName === name);
      entries.forEach((r, i) => rows.push([i === 0 ? name : '', r.amount, r.date, r.method, r.notes || '']));
      rows.push(['', '', '', '', '']);
    });
    await this.writeSheet('Investments', ['Investor Name', 'Amount (BDT )', 'Date', 'Payment Method', 'Notes'], rows);
  },
  async syncExpenses() { const d = Utils.lsGet('expenses'); await this.writeSheet('Business Expenses', ['Employee Name', 'Amount (BDT )', 'Date', 'Reason', 'Attachment'], d.map(r => [r.employeeName, r.amount, r.date, r.reason, r.attachment || ''])); },
  async syncProducts() { const d = Utils.lsGet('products'); await this.writeSheet('Product Expenses', ['Product Name', 'Item/Material', 'Supplier', 'Quantity', 'Cost (BDT )', 'Purchase Date'], d.map(r => [r.productName, r.itemName, r.supplier || '', r.quantity, r.cost, r.date])); },
  async syncMarketing() { const d = Utils.lsGet('marketing'); await this.writeSheet('Marketing & Ads', ['Platform', 'Campaign', 'Amount (BDT )', 'Date', 'Transaction ID', 'Notes'], d.map(r => [r.platform, r.campaignName || '', r.amount, r.date, r.transactionId || '', r.notes || ''])); },

  async syncAll(showToast = true) {
    if (!this.isConfigured()) { FU.toast('Google Sheets not configured. Go to Settings.', 'error'); return false; }
    if (showToast) FU.toast('Syncing to Google Sheets…', 'info');
    try {
      await this.syncInvestments(); await this.syncExpenses(); await this.syncProducts(); await this.syncMarketing();
      const s = this.getSettings(); s.lastSync = new Date().toISOString(); this.saveSettings(s);
      if (showToast) FU.toast('Synced to Google Sheets!', 'success');
      this.updateSyncUI(); return true;
    } catch (err) { FU.toast('Sync failed: ' + err.message, 'error'); return false; }
  },

  async autoSync(section) {
    if (!this.isConfigured()) return;
    const s = this.getSettings(); if (!s.autoSync) return;
    try {
      if (section === 'investments') await this.syncInvestments();
      else if (section === 'expenses') await this.syncExpenses();
      else if (section === 'products') await this.syncProducts();
      else if (section === 'marketing') await this.syncMarketing();
      const cfg = this.getSettings(); cfg.lastSync = new Date().toISOString(); this.saveSettings(cfg);
      FU.toast('Auto-synced!', 'success'); this.updateSyncUI();
    } catch (err) { FU.toast('Auto-sync failed: ' + err.message, 'error'); }
  },

  updateSyncUI() {
    const s = this.getSettings();
    document.querySelectorAll('.last-sync-time').forEach(el => el.textContent = s.lastSync ? 'Last: ' + new Date(s.lastSync).toLocaleTimeString() : 'Never');
    document.querySelectorAll('.sync-status-dot').forEach(d => d.style.background = s.lastSync ? '#22c55e' : '#9ca3af');
  },

  async testConnection() {
    const { spreadsheetId } = this.getAuth();
    if (!spreadsheetId) throw new Error('No Spreadsheet ID.');
    const info = await this.apiRequest('GET', `/${spreadsheetId}?fields=properties.title`);
    return info.properties?.title || 'Untitled';
  }
};

/* =====================================================================
   FUNCTION BUILDER MODULE
   ===================================================================== */
const FnBuilder = (() => {
  /* ── Storage ── */
  const LS_KEY = 'vavh_fn_builder_functions';

  function load() {
    return Utils.lsGet(LS_KEY);
  }
  function save(arr) {
    Utils.lsSet(LS_KEY, arr);
  }

  /* ── State ── */
  let editingId = null;
  let currentInputs = [];   // [{id, name, type, defaultVal}]
  let currentSteps = [];    // [{id, type:'math'|'condition', ...}]
  let inputIdCounter = 0;
  let stepIdCounter = 0;

  /* ── Category icon/color maps ── */
  const CAT_ICONS = { finance: 'fa-chart-line', customer: 'fa-user', dealer: 'fa-truck', order: 'fa-shopping-cart', custom: 'fa-code' };

  /* ── Utils ── */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function nextInputId() { return 'i_' + (++inputIdCounter); }
  function nextStepId() { return 's_' + (++stepIdCounter); }

  function allVarNames() {
    // Returns all declared variable names (inputs + step outputs)
    const names = currentInputs.map(i => i.name).filter(Boolean);
    currentSteps.forEach(s => {
      if (s.type === 'math' && s.outVar) names.push(s.outVar);
      if (s.type === 'condition') {
        if (s.trueVar) names.push(s.trueVar);
        if (s.falseVar) names.push(s.falseVar);
      }
    });
    return [...new Set(names)];
  }

  function formatValue(val, fmt) {
    const n = parseFloat(val);
    if (fmt === 'currency') return 'BDT ' + (isNaN(n) ? val : n.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    if (fmt === 'percent') return (isNaN(n) ? val : n.toFixed(2)) + '%';
    if (fmt === 'number') return isNaN(n) ? val : n.toLocaleString();
    return String(val);
  }

  /* ── Render list ── */
  function renderList() {
    const q = (document.getElementById('fnb-search')?.value || '').toLowerCase();
    const fns = load().filter(f => !q || f.name.toLowerCase().includes(q) || (f.desc || '').toLowerCase().includes(q));
    const grid = document.getElementById('fnb-cards-grid');
    const empty = document.getElementById('fnb-empty-state');
    const count = document.getElementById('fnb-count');
    if (!grid) return;
    const all = load();
    if (count) count.textContent = all.length + ' function' + (all.length !== 1 ? 's' : '');
    if (!fns.length) {
      grid.innerHTML = '';
      if (empty) empty.style.display = all.length ? 'none' : '';
      if (all.length && empty) empty.style.display = 'block';
      if (all.length) grid.innerHTML = `<div class="fnb-mini-empty" style="grid-column:1/-1">No functions match your search.</div>`;
      return;
    }
    if (empty) empty.style.display = 'none';
    grid.innerHTML = fns.map(fn => {
      const icon = CAT_ICONS[fn.category] || 'fa-code';
      const inputCount = (fn.inputs || []).length;
      const stepCount = (fn.steps || []).length;
      return `
      <div class="fnb-card" onclick="FnBuilder.openEdit('${fn.id}')">
        <div class="fnb-card-top">
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
            <div class="fnb-card-icon"><i class="fas ${icon}"></i></div>
            <div style="min-width:0">
              <div class="fnb-card-name">${Utils.esc(fn.name)}</div>
              <div class="fnb-card-desc">${Utils.esc(fn.desc || 'No description')}</div>
            </div>
          </div>
          <div class="fnb-card-actions" onclick="event.stopPropagation()">
            <button class="fnb-card-btn" title="Edit" onclick="FnBuilder.openEdit('${fn.id}')"><i class="fas fa-pen"></i></button>
            <button class="fnb-card-btn del" title="Delete" onclick="FnBuilder.deleteFunc('${fn.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="fnb-card-meta">
          <span class="fnb-pill cat-${fn.category}"><i class="fas ${icon}"></i> ${fn.category}</span>
          <span class="fnb-pill"><i class="fas fa-sign-in-alt"></i> ${inputCount} input${inputCount !== 1 ? 's' : ''}</span>
          <span class="fnb-pill"><i class="fas fa-sitemap"></i> ${stepCount} step${stepCount !== 1 ? 's' : ''}</span>
        </div>
        <button class="fnb-card-run-btn" onclick="event.stopPropagation();FnBuilder.openRunModal('${fn.id}')">
          <i class="fas fa-play"></i> Run Function
        </button>
      </div>`;
    }).join('');
  }

  /* ── Show / hide views ── */
  function showList() {
    document.getElementById('fnb-list-view').style.display = '';
    document.getElementById('fnb-editor-view').style.display = 'none';
    renderList();
  }

  function showEditor() {
    document.getElementById('fnb-list-view').style.display = 'none';
    document.getElementById('fnb-editor-view').style.display = '';
  }

  /* ── Open create ── */
  function openCreate() {
    editingId = null;
    currentInputs = [];
    currentSteps = [];
    document.getElementById('fnb-name').value = '';
    document.getElementById('fnb-desc').value = '';
    document.getElementById('fnb-category').value = 'finance';
    document.getElementById('fnb-output-label').value = 'Result';
    document.getElementById('fnb-output-format').value = 'currency';
    document.getElementById('fnb-editor-title').textContent = 'Create Function';
    renderInputsList();
    renderStepsList();
    refreshOutputVarSelect();
    clearPreview();
    showEditor();
  }

  /* ── Open edit ── */
  function openEdit(id) {
    const fn = load().find(f => f.id === id);
    if (!fn) return;
    editingId = id;
    currentInputs = JSON.parse(JSON.stringify(fn.inputs || []));
    currentSteps = JSON.parse(JSON.stringify(fn.steps || []));
    document.getElementById('fnb-name').value = fn.name || '';
    document.getElementById('fnb-desc').value = fn.desc || '';
    document.getElementById('fnb-category').value = fn.category || 'finance';
    document.getElementById('fnb-output-label').value = fn.outputLabel || 'Result';
    document.getElementById('fnb-output-format').value = fn.outputFormat || 'currency';
    document.getElementById('fnb-editor-title').textContent = 'Edit Function';
    renderInputsList();
    renderStepsList();
    refreshOutputVarSelect();
    if (fn.outputVar) document.getElementById('fnb-output-var').value = fn.outputVar;
    clearPreview();
    showEditor();
  }

  /* ── Delete ── */
  function deleteFunc(id) {
    if (!confirm('Delete this function?')) return;
    save(load().filter(f => f.id !== id));
    renderList();
    if (typeof FU !== 'undefined') FU.toast('Function deleted.', 'info');
  }

  /* ── Save ── */
  function saveFunc() {
    const name = document.getElementById('fnb-name').value.trim();
    if (!name) { alert('Please enter a function name.'); return; }
    const fn = {
      id: editingId || uid(),
      name,
      desc: document.getElementById('fnb-desc').value.trim(),
      category: document.getElementById('fnb-category').value,
      inputs: currentInputs,
      steps: currentSteps,
      outputVar: document.getElementById('fnb-output-var').value,
      outputLabel: document.getElementById('fnb-output-label').value.trim() || 'Result',
      outputFormat: document.getElementById('fnb-output-format').value,
      updatedAt: new Date().toISOString(),
    };
    const all = load();
    if (editingId) {
      const idx = all.findIndex(f => f.id === editingId);
      if (idx >= 0) all[idx] = fn; else all.push(fn);
    } else {
      all.unshift(fn);
    }
    save(all);
    if (typeof FU !== 'undefined') FU.toast('Function saved!', 'success');
    showList();
  }

  /* ── Add Input ── */
  function addInput() {
    currentInputs.push({ id: nextInputId(), name: '', type: 'number', defaultVal: '' });
    renderInputsList();
  }

  function removeInput(id) {
    currentInputs = currentInputs.filter(i => i.id !== id);
    renderInputsList();
    refreshAllStepSelects();
    refreshOutputVarSelect();
  }

  function updateInput(id, field, val) {
    const inp = currentInputs.find(i => i.id === id);
    if (inp) { inp[field] = val; }
    if (field === 'name') {
      refreshOutputVarSelect();
    }
    if (field === 'defaultVal') {
      renderPreviewInputs();
    }
  }

  function renderInputsList() {
    const el = document.getElementById('fnb-inputs-list');
    const emEl = document.getElementById('fnb-inputs-empty');
    if (!el) return;
    if (!currentInputs.length) { el.innerHTML = ''; if (emEl) emEl.style.display = ''; return; }
    if (emEl) emEl.style.display = 'none';
    el.innerHTML = currentInputs.map(inp => `
      <div class="fnb-input-row" id="inp_row_${inp.id}">
        <div class="form-group" style="margin:0">
          <div class="fnb-step-label">Variable Name</div>
          <input class="form-control" value="${Utils.esc(inp.name)}" placeholder="e.g. totalAmount" oninput="FnBuilder.updateInput('${Utils.esc(Utils.safeId(inp.id))}','name',this.value)" style="font-size:13px">
        </div>
        <div class="form-group" style="margin:0">
          <div class="fnb-step-label">Type</div>
          <select class="form-control" style="font-size:13px" onchange="FnBuilder.updateInput('${inp.id}','type',this.value)">
            <option value="number" ${inp.type === 'number' ? 'selected' : ''}>Number</option>
            <option value="text"   ${inp.type === 'text' ? 'selected' : ''}>Text</option>
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <div class="fnb-step-label">Default Value</div>
          <input class="form-control" value="${Utils.esc(inp.defaultVal || '')}" placeholder="Optional" oninput="FnBuilder.updateInput('${Utils.esc(Utils.safeId(inp.id))}','defaultVal',this.value)" style="font-size:13px">
        </div>
        <button class="fnb-row-del" onclick="FnBuilder.removeInput('${inp.id}')" title="Remove"><i class="fas fa-times"></i></button>
      </div>`).join('');
    renderPreviewInputs();
  }

  /* ── Steps ── */
  function addStep(type) {
    if (type === 'math') {
      currentSteps.push({ id: nextStepId(), type: 'math', leftVar: '', op: '+', rightVar: '', rightConst: '', useConst: false, outVar: '' });
    } else {
      currentSteps.push({ id: nextStepId(), type: 'condition', condLeft: '', condOp: '>', condRight: '', condConst: '', useConst: false, trueVar: '', trueVal: '', trueConst: false, falseVar: '', falseVal: '', falseConst: false });
    }
    renderStepsList();
    refreshOutputVarSelect();
  }

  function removeStep(id) {
    currentSteps = currentSteps.filter(s => s.id !== id);
    renderStepsList();
    refreshOutputVarSelect();
  }

  function updateStep(id, field, val) {
    const step = currentSteps.find(s => s.id === id);
    if (step) step[field] = val;
    refreshOutputVarSelect();
  }

  function varOptions(selectedVal, placeholder = '— variable —') {
    const vars = allVarNames();
    const opts = [`<option value="">${placeholder}</option>`];
    vars.forEach(v => opts.push(`<option value="${Utils.esc(v)}" ${v === selectedVal ? 'selected' : ''}>${Utils.esc(v)}</option>`));
    return opts.join('');
  }

  function renderStepsList() {
    const el = document.getElementById('fnb-steps-list');
    const emEl = document.getElementById('fnb-steps-empty');
    if (!el) return;
    if (!currentSteps.length) { el.innerHTML = ''; if (emEl) emEl.style.display = ''; return; }
    if (emEl) emEl.style.display = 'none';
    el.innerHTML = currentSteps.map((s, idx) => {
      if (s.type === 'math') return renderMathStep(s, idx);
      if (s.type === 'condition') return renderCondStep(s, idx);
      return '';
    }).join('');
  }

  function renderMathStep(s, idx) {
    const ops = ['+', '-', '*', '/'].map(o => `<option value="${o}" ${s.op === o ? 'selected' : ''}>${o}</option>`).join('');
    return `
    <div class="fnb-step-card type-math" id="step_${Utils.safeId(s.id)}">
      <div class="fnb-step-header">
        <span class="fnb-step-type-badge math"><i class="fas fa-calculator"></i> Math</span>
        <span style="font-size:11px;color:var(--text-muted)">Step ${idx + 1}</span>
        <button class="fnb-row-del" onclick="FnBuilder.removeStep('${Utils.esc(Utils.safeId(s.id))}')" title="Remove step"><i class="fas fa-times"></i></button>
      </div>
      <div class="fnb-step-row">
        <div>
          <div class="fnb-step-label">Left Operand</div>
          <select class="form-control" style="font-size:13px" onchange="FnBuilder.updateStep('${s.id}','leftVar',this.value)">${varOptions(s.leftVar)}</select>
        </div>
        <div>
          <div class="fnb-step-label">Operator</div>
          <select class="form-control" style="font-size:13px" onchange="FnBuilder.updateStep('${s.id}','op',this.value)">${ops}</select>
        </div>
        <div>
          <div class="fnb-step-label">Right Operand</div>
          <select class="form-control" style="font-size:13px;margin-bottom:4px" onchange="FnBuilder.updateStep('${s.id}','rightVar',this.value)">
            ${varOptions(s.rightVar, '— variable —')}</select>
          <input class="form-control" placeholder="or constant" value="${Utils.esc(s.rightConst || '')}" style="font-size:13px" oninput="FnBuilder.updateStep('${Utils.esc(Utils.safeId(s.id))}','rightConst',this.value)">
        </div>
        <button class="fnb-row-del" style="visibility:hidden"><i class="fas fa-times"></i></button>
      </div>
      <div style="margin-top:10px;display:flex;align-items:center;gap:8px">
        <div style="flex:1">
          <div class="fnb-step-label">Store result in variable</div>
          <input class="form-control" value="${Utils.esc(s.outVar || '')}" placeholder="e.g. totalDue" style="font-size:13px" oninput="FnBuilder.updateStep('${Utils.esc(Utils.safeId(s.id))}','outVar',this.value)">
        </div>
      </div>
    </div>`;
  }

  function renderCondStep(s, idx) {
    return `
    <div class="fnb-step-card type-condition" id="step_${Utils.safeId(s.id)}">
      <div class="fnb-step-header">
        <span class="fnb-step-type-badge condition"><i class="fas fa-code-branch"></i> If / Else</span>
        <span style="font-size:11px;color:var(--text-muted)">Step ${idx + 1}</span>
        <button class="fnb-row-del" onclick="FnBuilder.removeStep('${Utils.esc(Utils.safeId(s.id))}')" title="Remove step"><i class="fas fa-times"></i></button>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em">Condition</div>
      <div class="fnb-step-row-3">
        <div>
          <div class="fnb-step-label">Left</div>
          <select class="form-control" style="font-size:13px" onchange="FnBuilder.updateStep('${s.id}','condLeft',this.value)">${varOptions(s.condLeft)}</select>
        </div>
        <div>
          <div class="fnb-step-label">Compare</div>
          <select class="form-control" style="font-size:13px" onchange="FnBuilder.updateStep('${s.id}','condOp',this.value)">
            ${['>', '<', '>=', '<=', '==', '!='].map(o => `<option value="${o}" ${s.condOp === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
        <div>
          <div class="fnb-step-label">Right</div>
          <select class="form-control" style="font-size:13px;margin-bottom:4px" onchange="FnBuilder.updateStep('${s.id}','condRight',this.value)">
            ${varOptions(s.condRight, '— variable —')}</select>
          <input class="form-control" placeholder="or constant" value="${Utils.esc(s.condConst || '')}" style="font-size:13px" oninput="FnBuilder.updateStep('${Utils.esc(Utils.safeId(s.id))}','condConst',this.value)">
        </div>
      </div>
      <div class="fnb-cond-branches">
        <div class="fnb-branch">
          <div class="fnb-branch-label true"><i class="fas fa-check-circle"></i> IF TRUE — set:</div>
          <div class="fnb-step-label">Variable</div>
          <input class="form-control" value="${s.trueVar || ''}" placeholder="variable name" style="font-size:12px;margin-bottom:6px" oninput="FnBuilder.updateStep('${s.id}','trueVar',this.value)">
          <div class="fnb-step-label">= Value</div>
          <input class="form-control" value="${s.trueVal || ''}" placeholder="value or variable" style="font-size:12px" oninput="FnBuilder.updateStep('${s.id}','trueVal',this.value)">
        </div>
        <div class="fnb-branch">
          <div class="fnb-branch-label false"><i class="fas fa-times-circle"></i> IF FALSE — set:</div>
          <div class="fnb-step-label">Variable</div>
          <input class="form-control" value="${s.falseVar || ''}" placeholder="variable name" style="font-size:12px;margin-bottom:6px" oninput="FnBuilder.updateStep('${s.id}','falseVar',this.value)">
          <div class="fnb-step-label">= Value</div>
          <input class="form-control" value="${s.falseVal || ''}" placeholder="value or variable" style="font-size:12px" oninput="FnBuilder.updateStep('${s.id}','falseVal',this.value)">
        </div>
      </div>
    </div>`;
  }

  function refreshAllStepSelects() {
    renderStepsList();
  }

  function refreshOutputVarSelect() {
    const sel = document.getElementById('fnb-output-var');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = varOptions(cur, '— select result variable —');
  }

  /* ── Preview ── */
  function renderPreviewInputs() {
    const el = document.getElementById('fnb-preview-inputs');
    if (!el) return;
    if (!currentInputs.length) { el.innerHTML = '<div class="fnb-mini-empty">Add inputs to test.</div>'; return; }
    el.innerHTML = currentInputs.map(i => `
      <div class="form-group" style="margin:0">
        <label class="form-label" style="font-size:12px">${Utils.esc(i.name || '(unnamed)')}</label>
        <input type="${i.type === 'number' ? 'number' : 'text'}" class="form-control" id="prev_${Utils.esc(Utils.safeId(i.id))}" value="${Utils.esc(i.defaultVal || '')}" style="font-size:13px" placeholder="${i.type === 'number' ? '0' : 'text value'}">
      </div>`).join('');
  }

  function runPreview() {
    const outputVar = document.getElementById('fnb-output-var')?.value;
    const outputFmt = document.getElementById('fnb-output-format')?.value || 'number';
    const outputLbl = document.getElementById('fnb-output-label')?.value || 'Result';
    const fn = { inputs: currentInputs, steps: currentSteps, outputVar, outputFormat: outputFmt, outputLabel: outputLbl };
    const inputVals = {};
    currentInputs.forEach(i => {
      const el = document.getElementById('prev_' + i.id);
      inputVals[i.name] = el ? (i.type === 'number' ? parseFloat(el.value) || 0 : el.value) : (i.defaultVal || 0);
    });
    const { result, trace, error } = executeFunction(fn, inputVals);
    const resEl = document.getElementById('fnb-preview-result');
    const traceEl = document.getElementById('fnb-preview-trace');
    if (!resEl || !traceEl) return;
    if (error) {
      resEl.style.display = '';
      resEl.innerHTML = `<div class="result-label" style="color:var(--danger)">Error</div><div style="font-size:14px;color:var(--danger)">${Utils.esc(error)}</div>`;
      traceEl.style.display = 'none';
      return;
    }
    resEl.style.display = '';
    resEl.innerHTML = `<div class="result-label">${Utils.esc(outputLbl)}</div><div class="result-value">${Utils.esc(formatValue(result, outputFmt))}</div>`;
    traceEl.style.display = '';
    traceEl.innerHTML = trace.map((t, i) => `<div class="fnb-trace-line"><span class="fnb-trace-step">S${i + 1}</span><span>${Utils.esc(t)}</span></div>`).join('') || '<i>No steps executed.</i>';
  }

  function clearPreview() {
    const r = document.getElementById('fnb-preview-result');
    const t = document.getElementById('fnb-preview-trace');
    if (r) { r.style.display = 'none'; r.innerHTML = ''; }
    if (t) { t.style.display = 'none'; t.innerHTML = ''; }
    renderPreviewInputs();
  }

  /* ── Execute function logic ── */
  function executeFunction(fn, inputVals) {
    const vars = { ...inputVals };
    const trace = [];
    try {
      (fn.steps || []).forEach((step, idx) => {
        if (step.type === 'math') {
          const left = parseFloat(vars[step.leftVar]) || 0;
          const right = step.rightVar && vars[step.rightVar] !== undefined
            ? parseFloat(vars[step.rightVar]) || 0
            : parseFloat(step.rightConst) || 0;
          let res;
          if (step.op === '+') res = left + right;
          else if (step.op === '-') res = left - right;
          else if (step.op === '*') res = left * right;
          else if (step.op === '/') res = right !== 0 ? left / right : 0;
          else res = 0;
          if (step.outVar) vars[step.outVar] = res;
          trace.push(`${step.leftVar || '?'} ${step.op} ${step.rightVar || step.rightConst || '?'} = ${res} → stored in "${step.outVar || '?'}"`);
        } else if (step.type === 'condition') {
          const left = parseFloat(vars[step.condLeft]) || 0;
          const right = step.condRight && vars[step.condRight] !== undefined
            ? parseFloat(vars[step.condRight]) || 0
            : parseFloat(step.condConst) || 0;
          let cond;
          if (step.condOp === '>') cond = left > right;
          else if (step.condOp === '<') cond = left < right;
          else if (step.condOp === '>=') cond = left >= right;
          else if (step.condOp === '<=') cond = left <= right;
          else if (step.condOp === '==') cond = left == right;
          else if (step.condOp === '!=') cond = left != right;
          else cond = false;
          if (cond) {
            if (step.trueVar) {
              const val = vars[step.trueVal] !== undefined ? vars[step.trueVal] : parseFloat(step.trueVal) || step.trueVal || 0;
              vars[step.trueVar] = val;
              trace.push(`IF (${step.condLeft} ${step.condOp} ${step.condRight || step.condConst}) → TRUE → "${step.trueVar}" = ${val}`);
            }
          } else {
            if (step.falseVar) {
              const val = vars[step.falseVal] !== undefined ? vars[step.falseVal] : parseFloat(step.falseVal) || step.falseVal || 0;
              vars[step.falseVar] = val;
              trace.push(`IF (${step.condLeft} ${step.condOp} ${step.condRight || step.condConst}) → FALSE → "${step.falseVar}" = ${val}`);
            }
          }
        }
      });
      const result = fn.outputVar ? vars[fn.outputVar] : undefined;
      return { result: result !== undefined ? result : '—', trace };
    } catch (e) {
      return { result: null, trace, error: e.message };
    }
  }

  /* ── Run modal (from card) ── */
  function openRunModal(id) {
    const fn = load().find(f => f.id === id);
    if (!fn) return;
    let modal = document.getElementById('fnb-run-modal-overlay');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'fnb-run-modal-overlay';
      modal.className = 'fnb-run-modal-overlay';
      modal.innerHTML = `<div class="fnb-run-modal">
        <div class="fnb-run-modal-header">
          <h3 id="fnb-run-title"></h3>
          <button class="fin-modal-close" onclick="document.getElementById('fnb-run-modal-overlay').classList.remove('open')">&times;</button>
        </div>
        <div class="fnb-run-modal-body" id="fnb-run-body"></div>
        <div class="fnb-run-modal-footer">
          <button class="btn btn-sec btn-sm" onclick="document.getElementById('fnb-run-modal-overlay').classList.remove('open')">Close</button>
          <button class="btn btn-pri btn-sm" onclick="FnBuilder.executeRunModal()"><i class="fas fa-play"></i> Calculate</button>
        </div>
      </div>`;
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
      document.body.appendChild(modal);
    }
    modal._fnId = id;
    document.getElementById('fnb-run-title').textContent = fn.name;
    const body = document.getElementById('fnb-run-body');
    body.innerHTML = (fn.inputs || []).map(i => `
      <div class="form-group">
        <label class="form-label">${Utils.esc(i.name)} <span style="font-weight:400;color:var(--text-muted)">(${Utils.esc(i.type)})</span></label>
        <input type="${i.type === 'number' ? 'number' : 'text'}" class="form-control" id="rm_${Utils.esc(Utils.safeId(i.id))}" value="${Utils.esc(i.defaultVal || '')}" placeholder="${i.type === 'number' ? '0' : 'enter value'}">
      </div>`).join('') + `<div id="fnb-run-result" style="display:none;margin-top:12px"></div>`;
    modal.classList.add('open');
  }

  function executeRunModal() {
    const modal = document.getElementById('fnb-run-modal-overlay');
    if (!modal) return;
    const fn = load().find(f => f.id === modal._fnId);
    if (!fn) return;
    const inputVals = {};
    (fn.inputs || []).forEach(i => {
      const el = document.getElementById('rm_' + i.id);
      inputVals[i.name] = el ? (i.type === 'number' ? parseFloat(el.value) || 0 : el.value) : 0;
    });
    const { result, trace, error } = executeFunction(fn, inputVals);
    const resEl = document.getElementById('fnb-run-result');
    if (!resEl) return;
    resEl.style.display = '';
    if (error) {
      resEl.innerHTML = `<div style="background:var(--danger-light);border:1px solid var(--danger);border-radius:8px;padding:12px;color:var(--danger);font-size:13px"><i class="fas fa-exclamation-triangle"></i> ${Utils.esc(error)}</div>`;
      return;
    }
    resEl.innerHTML = `
      <div class="fnb-preview-result" style="display:block">
        <div class="result-label">${Utils.esc(fn.outputLabel || 'Result')}</div>
        <div class="result-value">${Utils.esc(formatValue(result, fn.outputFormat || 'number'))}</div>
      </div>
      <div class="fnb-preview-trace" style="display:block;margin-top:8px">
        ${trace.map((t, i) => `<div class="fnb-trace-line"><span class="fnb-trace-step">S${i + 1}</span><span>${Utils.esc(t)}</span></div>`).join('') || '<i>No steps.</i>'}
      </div>`;
  }

  /* ── Public API ── */
  return {
    init() {
      renderList();
    },
    renderList,
    openCreate,
    openEdit,
    deleteFunc,
    save: saveFunc,
    addInput,
    removeInput,
    updateInput,
    addStep,
    removeStep,
    updateStep,
    refreshOutputVarSelect,
    renderStepsList,
    runPreview,
    showList,
    openRunModal,
    executeRunModal,
  };
})();

/* Hook: init FnBuilder when module-finance is first shown */
document.addEventListener('DOMContentLoaded', () => {
  // FnBuilder will be initialized via finNavigate('fn-builder') when nav item is clicked
});



/* =====================================================================
   CROSS-PAGE SEARCH MAPPING
   Maps searchable terms → { module, page, tab, label }
   ===================================================================== */
const SEARCH_PAGE_MAP = [
  /* Management pages */
  { keywords: ['product', 'products', 'sku', 'stock', 'category', 'price', 'inventory management'], module: 'mgmt', tab: 'products', label: 'Product List' },
  { keywords: ['order', 'orders', 'order id', 'pending', 'completed', 'order management'], module: 'mgmt', tab: 'orders', label: 'Orders' },
  { keywords: ['customer', 'customers', 'client', 'contact', 'buyer'], module: 'mgmt', tab: 'customers', label: 'Customers' },
  { keywords: ['supplier', 'suppliers', 'vendor', 'company', 'supply'], module: 'mgmt', tab: 'suppliers', label: 'Suppliers' },
  { keywords: ['message', 'messages', 'chat', 'conversation'], module: 'mgmt', tab: 'chat', label: 'Messages' },
  { keywords: ['system user', 'sys user', 'users', 'user management', 'admin', 'role'], module: 'mgmt', tab: 'sys-users', label: 'System Users' },
  /* Finance pages */
  { keywords: ['dashboard', 'finance dashboard', 'overview', 'balance', 'summary'], module: 'finance', finPage: 'dashboard', label: 'Finance Dashboard' },
  { keywords: ['investment', 'investor', 'capital', 'funding'], module: 'finance', finPage: 'investments', label: 'Investments' },
  { keywords: ['revenue', 'order revenue', 'income', 'earning'], module: 'finance', finPage: 'order-revenue', label: 'Order Revenue' },
  { keywords: ['due', 'due tracker', 'payment due', 'debt'], module: 'finance', finPage: 'due-tracker', label: 'Due Tracker' },
  { keywords: ['expense', 'expenses', 'business expense', 'employee expense', 'spending'], module: 'finance', finPage: 'expenses', label: 'Business Expenses' },
  { keywords: ['product expense', 'product cost', 'material', 'production cost'], module: 'finance', finPage: 'products', label: 'Product Expenses' },
  { keywords: ['marketing', 'ads', 'advertising', 'campaign', 'facebook ad', 'google ad'], module: 'finance', finPage: 'marketing', label: 'Marketing & Ads' },
  { keywords: ['inventory', 'stock level', 'warehouse', 'manufactured', 'unsold'], module: 'finance', finPage: 'inventory', label: 'Inventory' },
  { keywords: ['dealer', 'dealer supplier', 'supplier record', 'transaction'], module: 'finance', finPage: 'dealer-supplier', label: 'Dealer / Supplier' },
  { keywords: ['function builder', 'formula', 'calculator', 'custom function', 'fn builder'], module: 'finance', finPage: 'fn-builder', label: 'Function Builder' },
  { keywords: ['finance message', 'finance chat'], module: 'finance', finPage: 'fin-messages', label: 'Finance Messages' },
  { keywords: ['report', 'export', 'csv', 'download data'], module: 'finance', finPage: 'reports', label: 'Reports / Export' },
  { keywords: ['settings', 'google sheets', 'sync', 'api token', 'integration'], module: 'finance', finPage: 'settings', label: 'Settings' },
  /* Social Media pages */
  { keywords: ['facebook', 'facebook ads', 'ads manager', 'fb ads', 'meta ads', 'facebook manager'], module: 'social', socialPage: 'facebook-ads', label: 'Facebook Ads Manager' },
  { keywords: ['whatsapp', 'whatsapp web', 'chat wa', 'wa web', 'whatsapp business'], module: 'social', socialPage: 'whatsapp', label: 'WhatsApp Web' },
  { keywords: ['social', 'social media', 'instagram', 'tiktok'], module: 'social', socialPage: 'facebook-ads', label: 'Social Media' },
];

/* Pending cross-page navigation target */
let _pendingSearchTarget = null;

/* ── Upgraded global search ── */
function handleGlobalSearch(query) {
  if (!query || !query.trim()) {
    const activeBtn = document.querySelector('#nav-mgmt .nav-item.active');
    const activeTab = activeBtn ? activeBtn.dataset.tab : 'home';
    switchTab(activeTab || 'home');
    dismissSearchBanner();
    return;
  }
  const q = query.toLowerCase().trim();
  const container = document.getElementById('mgmt-content');

  /* ── Search within Management data ── */
  const products = Utils.getData('products').filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
  const orders = Utils.getData('orders').filter(o => o.id?.toLowerCase().includes(q) || o.customerName?.toLowerCase().includes(q) || o.productName?.toLowerCase().includes(q));
  const customers = Utils.getData('customers').filter(c => c.name?.toLowerCase().includes(q) || c.contact?.toLowerCase().includes(q));
  const suppliers = Utils.getData('suppliers').filter(s => s.company?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q));
  const users = currentUser?.role === 'admin' ? Auth.getUsers().filter(u => u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)) : [];

  const mgmtTotal = products.length + orders.length + customers.length + suppliers.length + users.length;

  /* ── Cross-page mapping lookup ── */
  let crossPageMatch = null;
  if (mgmtTotal === 0) {
    // No results in Management — check if query maps to another page
    for (const mapping of SEARCH_PAGE_MAP) {
      if (mapping.keywords.some(kw => kw.includes(q) || q.includes(kw))) {
        crossPageMatch = mapping;
        break;
      }
    }
  }

  if (crossPageMatch) {
    // Show cross-page banner and offer redirect
    _pendingSearchTarget = crossPageMatch;
    const bannerText = document.getElementById('global-search-banner-text');
    bannerText.innerHTML = `No results in Management for "<strong>${Utils.esc(query)}</strong>". Found match in <strong>${crossPageMatch.label}</strong>.`;
    document.getElementById('global-search-banner').classList.add('show');
    // Show a "did you mean?" hint in the content area
    container.innerHTML = `<div class="glass-panel" style="padding:28px;text-align:center;">
      <i class="fas fa-search" style="font-size:2.5rem;opacity:0.3;margin-bottom:14px;display:block;color:var(--accent-green)"></i>
      <h3 style="color:var(--text-muted-dark);margin-bottom:8px;">No results in Management</h3>
      <p style="color:rgba(255,255,255,0.4);font-size:13px;margin-bottom:20px;">We found "<strong style="color:var(--accent-green)">${Utils.esc(query)}</strong>" in <strong style="color:#fff">${crossPageMatch.label}</strong></p>
      <button class="btn-primary-mgmt" onclick="globalSearchGoto()" style="display:inline-flex;align-items:center;gap:8px;">
        <i class="fas fa-arrow-right"></i> Go to ${crossPageMatch.label}
      </button>
    </div>`;
    return;
  }

  // Clear banner if we have local results
  dismissSearchBanner();

  const total = mgmtTotal;
  let html = `<div class="glass-panel" style="padding:22px;"><h3 style="color:var(--text-muted-dark);margin-bottom:16px;">Search: "<strong>${Utils.esc(query)}</strong>" — ${total} result${total !== 1 ? 's' : ''}</h3>`;

  if (total === 0) {
    html += `<div style="text-align:center;padding:40px;color:var(--text-muted-dark);"><i class="fas fa-search" style="font-size:2.5rem;opacity:0.3;margin-bottom:14px;display:block;"></i><p>No results found for "<strong>${Utils.esc(query)}</strong>" across any module.</p></div>`;
  } else {
    if (products.length) html += renderSearchSection('Products', products, ['SKU', 'Name', 'Category', 'Price', 'Stock'], p => `<td>${Utils.esc(p.sku)}</td><td>${Utils.esc(p.name)}</td><td>${Utils.esc(p.category)}</td><td>BDT ${Number(p.price || 0)}</td><td><span class="${parseInt(p.stock) < 5 ? 'status-badge alert-badge' : 'status-badge'}">${Number(p.stock || 0)}</span></td><td><button class="action-btn edit-btn" onclick="openMgmtModal('product','${Utils.esc(Utils.safeId(p.id))}')"><i class="fas fa-edit"></i></button><button class="action-btn delete-btn" onclick="deleteItem('products','${Utils.esc(Utils.safeId(p.id))}')"><i class="fas fa-trash"></i></button></td>`);
    if (orders.length) html += renderSearchSection('Orders', orders, ['Order ID', 'Customer', 'Details', 'Total', 'Status'], o => `<td>${Utils.esc(o.id)}</td><td>${Utils.esc(o.customerName)}</td><td>${Utils.esc(o.productName)} (x${Number(o.qty || 0)})</td><td>BDT ${Number(o.total || 0)}</td><td><span class="status-badge">${Utils.esc(o.status)}</span></td><td><button class="action-btn edit-btn" onclick="openMgmtModal('order','${Utils.esc(Utils.safeId(o.id))}')"><i class="fas fa-edit"></i></button><button class="action-btn delete-btn" onclick="deleteItem('orders','${Utils.esc(Utils.safeId(o.id))}')"><i class="fas fa-trash"></i></button></td>`);
    if (customers.length) html += renderSearchSection('Customers', customers, ['Name', 'Contact', 'Address'], c => `<td>${Utils.esc(c.name)}</td><td>${Utils.esc(c.contact)}</td><td>${Utils.esc(c.address)}</td><td><button class="action-btn edit-btn" onclick="openMgmtModal('customer','${Utils.esc(Utils.safeId(c.id))}')"><i class="fas fa-edit"></i></button><button class="action-btn delete-btn" onclick="deleteItem('customers','${Utils.esc(Utils.safeId(c.id))}')"><i class="fas fa-trash"></i></button></td>`);
    if (suppliers.length) html += renderSearchSection('Suppliers', suppliers, ['Company', 'Contact', 'Phone'], s => `<td><strong>${Utils.esc(s.company)}</strong></td><td>${Utils.esc(s.name)}</td><td>${Utils.esc(s.number)}</td><td><button class="action-btn edit-btn" onclick="openMgmtModal('supplier','${Utils.esc(Utils.safeId(s.id))}')"><i class="fas fa-edit"></i></button><button class="action-btn delete-btn" onclick="deleteItem('suppliers','${Utils.esc(Utils.safeId(s.id))}')"><i class="fas fa-trash"></i></button></td>`);
    if (users.length) html += renderSearchSection('Users', users, ['Name', 'Username', 'Role'], u => `<td><strong>${Utils.esc(u.name)}</strong></td><td>@${Utils.esc(u.username)}</td><td>${Utils.esc(u.role)}</td><td><button class="action-btn edit-btn" onclick="openMgmtModal('user','${u.id}')"><i class="fas fa-edit"></i></button></td>`);
  }

  html += `</div>`;
  container.innerHTML = html;
}

/* Navigate to the cross-page match target */
function globalSearchGoto() {
  if (!_pendingSearchTarget) return;
  const t = _pendingSearchTarget;
  dismissSearchBanner();
  if (t.module === 'mgmt') {
    switchModule('mgmt');
    requestAnimationFrame(() => { switchTab(t.tab); });
  } else if (t.module === 'finance') {
    switchModule('finance');
    requestAnimationFrame(() => { finNavigate(t.finPage); });
  }
  _pendingSearchTarget = null;
}

function dismissSearchBanner() {
  document.getElementById('global-search-banner').classList.remove('show');
}

// Finance table sort header helper
function applySortHeaders(selector, module) {
  document.querySelectorAll(`th[data-sort="${selector}"]`).forEach(th => {
    th.addEventListener('click', () => {
      const k = th.dataset.key;
      module.sortDir = module.sortKey === k && module.sortDir === 'asc' ? 'desc' : 'asc';
      module.sortKey = k;
      document.querySelectorAll(`th[data-sort="${selector}"]`).forEach(h => {
        h.classList.toggle('sorted', h.dataset.key === k);
        const icon = h.querySelector('span');
        if (icon) icon.textContent = h.dataset.key === k ? (module.sortDir === 'asc' ? '↑' : '↓') : '↕';
      });
      module.render();
    });
  });
}

// Sync Finance supplier dropdown whenever Management suppliers are created/updated
window.addEventListener('vavh-suppliers-updated', () => {
  const modal = document.getElementById('productModal');
  if (modal && modal.classList.contains('open')) {
    FinProducts.refreshSupplierDropdown(FinProducts.getSupplierValue());
  }
});

/* =====================================================================
   ENTRY POINT — everything that touches the DOM waits for it to be ready
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () => {

  // ── Nav handler attachment ──────────────────────────────────────────
  attachMgmtNavHandlers();
  attachFinanceNavHandlers();

  // ── Finance form submissions ────────────────────────────────────────
  document.getElementById('investmentForm').addEventListener('submit', e => { e.preventDefault(); Investments.saveRecord(); });
  document.getElementById('expenseForm').addEventListener('submit', e => { e.preventDefault(); Expenses.saveRecord(); });
  document.getElementById('productForm').addEventListener('submit', e => { e.preventDefault(); FinProducts.saveRecord(); });
  document.getElementById('marketingForm').addEventListener('submit', e => { e.preventDefault(); Marketing.saveRecord(); });
  document.getElementById('userForm').addEventListener('submit', e => { e.preventDefault(); UserMgmt.save(); });

  // ── Finance search inputs ───────────────────────────────────────────
  document.getElementById('inv-search').addEventListener('input', () => Investments.render());
  document.getElementById('exp-search').addEventListener('input', () => Expenses.render());
  document.getElementById('prod-search').addEventListener('input', () => FinProducts.render());
  document.getElementById('mkt-search').addEventListener('input', () => Marketing.render());

  // ── Finance table sort headers ──────────────────────────────────────
  applySortHeaders('inv', Investments);
  applySortHeaders('exp', Expenses);
  applySortHeaders('prod', FinProducts);
  applySortHeaders('mkt', Marketing);

  // ── Attachment file input ───────────────────────────────────────────
  document.getElementById('attachmentInput').addEventListener('change', e => {
    const f = e.target.files[0]; const el = document.getElementById('exp-fileName');
    if (f) { Expenses.pendingFile = f.name; if (el) el.textContent = ' ' + f.name; }
    else { Expenses.pendingFile = null; if (el) el.textContent = ''; }
  });

  // ── Mobile sidebar overlay ──────────────────────────────────────────
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  // ── Login keyboard shortcuts ────────────────────────────────────────
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') Auth.login();
  });
  document.getElementById('login-identifier').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-password').focus();
  });

  // ── Management modal — close on overlay click ───────────────────────
  document.getElementById('mgmt-modal-overlay').addEventListener('click', function (e) {
    if (e.target === this) closeMgmtModal();
  });

  // ── Order → Finance sync: refresh Finance Dashboard when an order is completed ──
  window.addEventListener('vavh-order-completed', () => {
    // Real-time balance update — completed order revenue added to balance
    const finDash = document.getElementById('fin-page-dashboard');
    if (finDash && finDash.classList.contains('active')) FinDashboard.init();
    const orPage = document.getElementById('fin-page-order-revenue');
    if (orPage && orPage.classList.contains('active')) OrderRevenue.render();
    // Refresh inventory page if visible (sold count updates)
    const invPage = document.getElementById('fin-page-inventory');
    if (invPage && invPage.classList.contains('active')) Inventory.render();
    // Refresh reports if open
    const repPage = document.getElementById('fin-page-reports');
    if (repPage && repPage.classList.contains('active')) renderReports();
  });
  window.addEventListener('vavh-order-uncompleted', () => {
    const finDash = document.getElementById('fin-page-dashboard');
    if (finDash && finDash.classList.contains('active')) FinDashboard.init();
    const orPage = document.getElementById('fin-page-order-revenue');
    if (orPage && orPage.classList.contains('active')) OrderRevenue.render();
    const invPage = document.getElementById('fin-page-inventory');
    if (invPage && invPage.classList.contains('active')) Inventory.render();
    const repPage = document.getElementById('fin-page-reports');
    if (repPage && repPage.classList.contains('active')) renderReports();
  });

  // ── Bootstrap auth / session check ─────────────────────────────────
  // NOTE: Auth.checkSession() is called from api.js after all patches are applied.
  // We skip it here to avoid a double-call with the un-patched version.
  initBWMode();
  // Auth.checkSession();  ← moved to api.js
});