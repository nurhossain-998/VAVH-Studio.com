// ============================================================
//  api.js — V.A.V.H Studio Frontend ↔ Backend Bridge
//
//  This file is loaded BEFORE the main app scripts.
//  It does three things:
//    1. Provides a simple API() helper for all fetch calls
//    2. Overrides the Auth object to use sessions instead of localStorage
//    3. Overrides the Utils.getData / Utils.saveData functions so all
//       existing module code (Investments, Expenses, Orders, etc.)
//       transparently reads/writes to the MySQL backend instead of
//       localStorage — no changes needed inside those modules.
//
//  KEY DESIGN DECISION:
//    The existing app uses localStorage heavily and renders synchronously.
//    Rather than rewriting thousands of lines, we use a "write-through cache":
//      - On page load, we fetch all data from the API and cache it in memory.
//      - Reads (Utils.getData) serve from the in-memory cache (instant, no flicker).
//      - Writes (Utils.saveData) update the cache immediately, then sync to API.
//    This keeps the UI snappy while persisting everything to MySQL.
// ============================================================

/* ── 1. Low-level API helper ───────────────────────────────
   All API calls go through this function.
   Returns the parsed JSON response, or throws on error.
─────────────────────────────────────────────────────────── */
const API = {
  // Base URL — since frontend is served from same server, no need for full URL
  BASE: '/api',

  async request(method, path, body = null) {
    const opts = {
      method,
      headers: {},
      credentials: 'include',   // Send session cookie with every request
    };

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      try {
        const existing = sessionStorage.getItem('vavh_csrf_token');
        if (!existing) {
          const csrfRes = await fetch('/api/csrf-token', { method: 'GET', credentials: 'include' });
          const csrfData = await csrfRes.json();
          if (csrfRes.ok && csrfData.success && csrfData.csrfToken) {
            sessionStorage.setItem('vavh_csrf_token', csrfData.csrfToken);
          }
        }
      } catch (err) {
        console.warn('[CSRF] Unable to fetch token:', err);
      }
    }

    const csrfToken = sessionStorage.getItem('vavh_csrf_token');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
      opts.headers['X-CSRF-Token'] = csrfToken;
    }

    if (body) {
      if (body instanceof FormData) {
        opts.body = body;
      } else {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }

    try {
      const res  = await fetch(this.BASE + path, opts);
      const data = await res.json();

      if (!res.ok && res.status === 401) {
        return { ...data, success: false, status: res.status };
      }
      return res.ok ? data : { ...data, success: false, status: res.status };
    } catch (err) {
      console.error(`API ${method} ${path} failed:`, err);
      return { success: false, message: 'Network error — is the server running?' };
    }
  },

  get(path)         { return this.request('GET',    path); },
  post(path, body)  { return this.request('POST',   path, body); },
  put(path, body)   { return this.request('PUT',    path, body); },
  patch(path, body) { return this.request('PATCH',  path, body); },
  del(path)         { return this.request('DELETE', path); },
};


/* ── 2. In-memory data cache ──────────────────────────────
   All data for the app lives here after page load.
   Shape mirrors what the original localStorage keys contained.
─────────────────────────────────────────────────────────── */
const _cache = {
  customers:    [],
  suppliers:    [],
  products:     [],
  orders:       [],
  users:        [],
  investments:  [],
  expenses:     [],
  product_costs:[],  // Finance product expenses — key: 'products' in old code
  marketing:    [],
  dealer_supplier: [],
  chats:        [],
  messages:     [],
  inventory_adjustments: [],
  fn_builder_functions: [],
  due_records: [],
};

// Map old localStorage key names → new cache key names
// The original code used Utils.getData('products') for BOTH management products
// AND finance product-costs (stored under different LS keys).
// We disambiguate using the MGMT_KEY prefix:
//   Utils.getData('products')   → management products   → _cache.products
//   Utils.lsGet('products')     → finance product costs → _cache.product_costs
const MGMT_CACHE_MAP = {
  customers:   'customers',
  suppliers:   'suppliers',
  products:    'products',
  orders:      'orders',
  chats:       'chats',
  messages:    'messages',
};

const FIN_CACHE_MAP = {
  investments:        'investments',
  expenses:           'expenses',
  products:           'product_costs',  // Finance product costs uses key 'products' in old code
  marketing:          'marketing',
  vavh_dealer_supplier: 'dealer_supplier',
  vavh_due_records:   'due_records',
  vavh_fn_builder_functions: 'fn_builder_functions',
};


/* ── 3. Load all data from the server on startup ──────────
   Called once after login succeeds.
─────────────────────────────────────────────────────────── */
async function _loadAllData() {
  try {
    // Wrap each API call to handle failures gracefully
    const safeGet = async (path) => {
      try {
        const result = await API.get(path);
        return result || { success: false };
      } catch (err) {
        console.warn(`Failed to load ${path}:`, err);
        return { success: false };
      }
    };

    const [
      customers, suppliers, products, orders, users,
      investments, expenses, productCosts, marketing, dealerSupplier,
      inventoryAdj, chats, messages, functions, dueRecords
    ] = await Promise.all([
      safeGet('/customers'),
      safeGet('/suppliers'),
      safeGet('/products'),
      safeGet('/orders'),
      safeGet('/users'),
      safeGet('/finance/investments').catch(() => ({ success: false })),
      safeGet('/finance/expenses').catch(() => ({ success: false })),
      safeGet('/finance/product-costs').catch(() => ({ success: false })),
      safeGet('/finance/marketing').catch(() => ({ success: false })),
      safeGet('/finance/dealer-supplier').catch(() => ({ success: false })),
      safeGet('/finance/inventory-adjustments').catch(() => ({ success: false })),
      safeGet('/finance/chats').catch(() => ({ success: false })),
      safeGet('/finance/messages').catch(() => ({ success: false })),
      safeGet('/finance/functions').catch(() => ({ success: false })),
      safeGet('/finance/due-tracking').catch(() => ({ success: false })),
    ]);

    if (customers?.success)      _cache.customers      = _normalizeRows(customers.data);
    if (suppliers?.success)      _cache.suppliers      = _normalizeRows(suppliers.data);
    if (products?.success)       _cache.products       = _normalizeRows(products.data);
    if (orders?.success)         _cache.orders         = _normalizeOrders(orders.data);
    if (users?.success)          _cache.users          = _normalizeRows(users.data);
    if (investments?.success)    _cache.investments    = _normalizeFinRows(investments.data);
    if (expenses?.success)       _cache.expenses       = _normalizeFinRows(expenses.data);
    if (productCosts?.success)   _cache.product_costs  = _normalizeProductCosts(productCosts.data);
    if (marketing?.success)      _cache.marketing      = _normalizeFinRows(marketing.data);
    if (dealerSupplier?.success) _cache.dealer_supplier = _normalizeDealerSupplier(dealerSupplier.data);
    if (inventoryAdj?.success)   _cache.inventory_adjustments = _normalizeInventoryAdj(inventoryAdj.data);
    if (chats?.success)          _cache.chats          = _normalizeFinRows(chats.data);
    if (messages?.success)       _cache.messages       = _normalizeMessages(messages.data);
    if (functions?.success)      _cache.fn_builder_functions = functions.data;
    if (dueRecords?.success)     _cache.due_records    = _normalizeDueRecords(dueRecords.data);

    console.log('✅ All data loaded from server:', {
      customers: _cache.customers.length,
      products:  _cache.products.length,
      orders:    _cache.orders.length,
      inventory: _cache.inventory_adjustments.length,
      messages:  _cache.messages.length,
    });
  } catch (err) {
    console.error('Failed to load initial data:', err);
  }
}

// ── Normalize DB row keys to match what the original JS expects ──

// Management rows have snake_case from MySQL → camelCase expected by UI
function _normalizeRows(rows = []) {
  return rows.map(r => ({
    id:          r.id,
    name:        r.name        || r.company || '',
    company:     r.company     || '',
    contact:     r.contact     || r.number  || '',
    number:      r.number      || '',
    email:       r.email       || '',
    address:     r.address     || '',
    notes:       r.notes       || r.designation || '',
    // Product-specific
    sku:         r.sku         || '',
    category:    r.category    || '',
    price:       r.price       || 0,
    stock:       r.stock       || 0,
    supplier:    r.supplier    || '',
    manufacturerPrice: r.manufacturer_price || 0,
    // User-specific
    username:    r.username    || '',
    role:        r.role        || 'user',
    designation: r.designation || '',
    avatar:      r.avatar      || '',
    createdAt:   r.created_at  || new Date().toISOString(),
  }));
}

function _normalizeOrders(rows = []) {
  return rows.map(r => ({
    id:             r.id,
    customerName:   r.customer_name   || '',
    productName:    r.product_name    || '',
    productId:      r.product_id      || '',
    qty:            r.qty             || 1,
    total:          r.total           || 0,
    status:         r.status          || 'Pending',
    financeNameDue: r.finance_name_due || '',
    dueTotal:       r.due_total       || 0,
    duePaid:        r.due_paid        || 0,
    dueRemaining:   r.due_remaining   || 0,
    notes:          r.notes           || '',
    completedAt:    r.completed_at    || null,
    createdAt:      r.created_at      || new Date().toISOString(),
    updatedAt:      r.updated_at      || null,
  }));
}

function _normalizeFinRows(rows = []) {
  // Finance rows keep their snake_case but add camelCase aliases
  return rows.map(r => {
    const base = { ...r };
    // Add camelCase aliases the original code expects
    if (r.investor_name !== undefined) base.investorName   = r.investor_name;
    if (r.employee_name !== undefined) base.employeeName   = r.employee_name;
    if (r.campaign_name !== undefined) base.campaignName   = r.campaign_name;
    if (r.transaction_id !== undefined) base.transactionId = r.transaction_id;
    if (r.created_at    !== undefined) base.createdAt      = r.created_at;
    return base;
  });
}

function _normalizeProductCosts(rows = []) {
  return rows.map(r => ({
    ...r,
    id:          r.id,
    productName: r.product_name || '',
    itemName:    r.item_name    || '',
    supplier:    r.supplier     || '',
    quantity:    r.quantity     || 1,
    cost:        r.cost         || 0,
    date:        r.date         || '',
    notes:       r.notes        || '',
    createdAt:   r.created_at   || new Date().toISOString(),
  }));
}

function _normalizeDealerSupplier(rows = []) {
  return rows.map(r => ({
    ...r,
    id:           r.id,
    supplierName: r.supplier_name || '',
    product:      r.product       || '',
    amount:       r.amount        || 0,
    paid:         r.paid          || 0,
    date:         r.date          || '',
    status:       r.status        || 'Pending',
    note:         r.note          || '',
    createdAt:    r.created_at    || new Date().toISOString(),
  }));
}

function _normalizeInventoryAdj(rows = []) {
  return rows.map(r => ({
    ...r,
    id:          r.id,
    productId:   r.product_id    || '',
    productName: r.product_name  || '',
    adjType:     r.adj_type      || 'manufacture',
    qty:         r.qty           || 0,
    reference:   r.reference     || '',
    note:        r.note          || '',
    date:        r.date          || '',
    createdAt:   r.created_at    || new Date().toISOString(),
  }));
}

function _normalizeDueRecords(rows = []) {
  return rows.map(r => ({
    ...r,
    id:               r.id,
    partyName:        r.party_name || '',
    description:      r.description || '',
    financeNameDue:   r.finance_name_due || '',
    dueTotal:         r.due_total || 0,
    duePaid:          r.due_paid || 0,
    dueRemaining:     r.due_remaining || 0,
    dueDate:          r.due_date || '',
    dueStatus:        r.due_status || 'Pending',
    notes:            r.notes || '',
    _type:            r._type || 'standalone',
    createdAt:        r.created_at || new Date().toISOString(),
  }));
}

function _normalizeMessages(rows = []) {
  return rows.map(r => ({
    ...r,
    id:        r.id,
    chatId:    r.chat_id   || '',
    senderId:  r.sender_id || '',
    sender:    r.sender    || 'Anonymous',
    message:   r.message   || '',
    timestamp: r.timestamp || new Date().toISOString(),
  }));
}


/* ── 4. Override Utils.getData / Utils.saveData ───────────
   The original code calls these everywhere. We redirect them
   to our in-memory cache and also sync to the API.
─────────────────────────────────────────────────────────── */

// We need to wait for the original Utils object to be defined, then override
// We use a deferred override pattern: run after DOMContentLoaded scripts

window._apiReady = false;  // Set to true after data is loaded

// Called after the original scripts define `Utils`
function _patchUtils() {
  if (typeof Utils === 'undefined') return;

  // ── Override getData (reads from cache) ─────────────────
  Utils.getData = function(type) {
    switch (type) {
      case 'customers': return _cache.customers;
      case 'suppliers': return _cache.suppliers;
      case 'products':  return _cache.products;
      case 'orders':    return _cache.orders;
      case 'chats':     return _cache.chats;
      case 'messages':  return _cache.messages;
      default:          return [];
    }
  };

  // ── Override saveData (updates cache + syncs to API) ────
  // saveData is called for create/edit/delete in management module
  Utils.saveData = function(type, data) {
    // Always update cache immediately (keeps UI responsive)
    switch (type) {
      case 'customers': _cache.customers = data; break;
      case 'suppliers': _cache.suppliers = data; break;
      case 'products':  _cache.products  = data; break;
      case 'orders':    _cache.orders    = data; break;
      case 'chats':     
        _cache.chats     = data; 
        // Sync chat to API if it's new
        const latestChat = data[data.length - 1];
        if (latestChat && !latestChat._synced) {
          latestChat._synced = true;
          API.post('/finance/chats', {
            name: latestChat.name,
            members: latestChat.members
          });
        }
        break;
      case 'messages':  
        _cache.messages  = data; 
        // Sync message to API if it's new
        const latest = data[data.length - 1];
        if (latest && !latest._synced) {
          latest._synced = true;
          API.post('/finance/messages', {
            chat_id: latest.chatId,
            sender_id: latest.senderId,
            sender: latest.sender,
            message: latest.message
          });
        }
        break;
    }
    // Note: The management module handles API sync through openMgmtModal forms.
    // saveData here acts as cache-write for data that's already been persisted
    // by the API call (e.g., after stock adjustment).
  };

  // ── Override lsGet (Finance module reads) ───────────────
  Utils.lsGet = function(key) {
    switch (key) {
      case 'investments':           return _cache.investments;
      case 'expenses':              return _cache.expenses;
      case 'products':              return _cache.product_costs;  // Finance product costs
      case 'marketing':             return _cache.marketing;
      case 'vavh_dealer_supplier':  return _cache.dealer_supplier;
      case 'vavh_inventory_adjustments': return _cache.inventory_adjustments;
      case 'chats':                 return _cache.chats;
      case 'messages':              return _cache.messages;
      case 'vavh_due_records':      return _cache.due_records;
      case 'vavh_fn_builder_functions': return _cache.fn_builder_functions;
      default:                      return [];
    }
  };

  // ── Override lsSet (Finance module writes — cache only) ─
  Utils.lsSet = function(key, data) {
    switch (key) {
      case 'investments':           _cache.investments    = data; break;
      case 'expenses':              _cache.expenses       = data; break;
      case 'products':              _cache.product_costs  = data; break;
      case 'marketing':             _cache.marketing      = data; break;
      case 'vavh_dealer_supplier':  _cache.dealer_supplier = data; break;
      case 'vavh_inventory_adjustments': _cache.inventory_adjustments = data; break;
      case 'chats':                 _cache.chats          = data; break;
      case 'messages':              _cache.messages       = data; break;
      case 'vavh_due_records':      _cache.due_records    = data; break;
      case 'vavh_fn_builder_functions': _cache.fn_builder_functions = data; break;
    }
  };

  console.log('✅ Utils patched — all reads/writes use MySQL backend');
}


/* ── 5. Override Auth object ──────────────────────────────
   Replace localStorage/sessionStorage auth with server sessions
─────────────────────────────────────────────────────────── */

function _patchAuth() {
  if (typeof Auth === 'undefined') return;

  // ── Override login to call POST /api/auth/login ─────────
  Auth.login = async function() {
    const identifier = document.getElementById('login-identifier').value.trim();
    const password   = document.getElementById('login-password').value;
    const err        = document.getElementById('login-error');
    err.classList.remove('show');

    if (!identifier || !password) {
      err.textContent = 'Please enter your credentials.';
      err.classList.add('show');
      return;
    }

    // Show loading state on button
    const btn = document.querySelector('.login-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…'; }

    const result = await API.post('/auth/login', { identifier, password });

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In'; }

    if (!result || !result.success) {
      err.textContent = (result && result.message) || 'Login failed. Please try again.';
      err.classList.add('show');
      document.getElementById('login-password').value = '';
      return;
    }

    // Load all app data, then show the app
    await _loadAllData();
    window._apiReady = true;

    currentUser = result.user;
    this.onLoginSuccess(result.user);
    FU.toast(result.message || 'Welcome back!', 'success');
  };

  // ── Override logout ──────────────────────────────────────
  Auth.logout = async function() {
    if (!confirm('Sign out?')) return;
    await API.post('/auth/logout');
    currentUser = null;
    // Clear cache on logout
    Object.keys(_cache).forEach(k => { _cache[k] = []; });
    window.location.href = '/platform/login.html';
  };

  // ── Override checkSession ────────────────────────────────
  Auth.checkSession = async function() {
    // initDefaults no longer needed — DB has default admin
    const result = await API.get('/auth/session');

    if (result && result.success && result.user) {
      // Active session found — load data and show app
      await _loadAllData();
      window._apiReady = true;
      currentUser = result.user;
      this.onLoginSuccess(result.user);
    } else {
      // No session — show login screen
      window.location.href = '/platform/login.html';
    }
  };

  // ── Override getUsers (reads from cache) ─────────────────
  Auth.getUsers    = function() { return _cache.users; };
  Auth.saveUsers   = async function(users) {
    // saveUsers is called after local edits in management module.
    // We don't batch-save users here — individual updates go through
    // the /api/users PUT endpoint called from our patched form handlers.
    _cache.users = users;
  };

  // ── Session helpers — no longer needed (server handles it) ──
  Auth.getCurrentUser = function() { return currentUser; };
  Auth.setSession     = function() {};  // no-op — server manages session
  Auth.clearSession   = function() {};  // handled in logout()
  Auth.initDefaults   = function() {};  // no-op — DB has default admin

  console.log('✅ Auth patched — using server-side sessions');
}


/* ── 6. Patch Management form handlers ────────────────────
   Replace localStorage-only saves with API calls.
   The originals call Utils.saveData() after pushing to array —
   we intercept at the form-submit level instead to call the API.
─────────────────────────────────────────────────────────── */

function _patchManagementForms() {

  // ── Patch handleMgmtFormSubmit (customers, suppliers, products) ──
  const _origOpenMgmtModal = window.openMgmtModal;
  window.openMgmtModal = function(type, id) {
    _origOpenMgmtModal && _origOpenMgmtModal(type, id);
  };

  // Override the form submission handler that the management module uses
  // The management module builds forms dynamically and attaches onsubmit.
  // We override handleMgmtSubmit (called from those forms):
  window.handleMgmtFormSubmit = async function(e, type, id) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data     = Object.fromEntries(formData.entries());

    let result;

    if (type === 'customer') {
      if (id) {
        result = await API.put(`/customers/${id}`, data);
      } else {
        result = await API.post('/customers', data);
        if (result?.success) {
          _cache.customers.unshift({ ...data, id: result.id, createdAt: new Date().toISOString() });
        }
      }
      if (result?.success) {
        if (id) {
          const idx = _cache.customers.findIndex(c => c.id === id);
          if (idx > -1) _cache.customers[idx] = { ..._cache.customers[idx], ...data };
        }
        closeMgmtModal();
        showToast(result.message || 'Saved!');
        switchTab('customers');
      } else {
        showToast(result?.message || 'Save failed.', true);
      }

    } else if (type === 'supplier') {
      if (id) {
        result = await API.put(`/suppliers/${id}`, data);
      } else {
        result = await API.post('/suppliers', data);
        if (result?.success) {
          _cache.suppliers.unshift({ ...data, id: result.id, createdAt: new Date().toISOString() });
        }
      }
      if (result?.success) {
        if (id) {
          const idx = _cache.suppliers.findIndex(s => s.id === id);
          if (idx > -1) _cache.suppliers[idx] = { ..._cache.suppliers[idx], ...data };
        }
        closeMgmtModal();
        showToast(result.message || 'Saved!');
        switchTab('suppliers');
      } else {
        showToast(result?.message || 'Save failed.', true);
      }

    } else if (type === 'product') {
      const payload = {
        name:               data.name,
        sku:                data.sku,
        category:           data.category,
        price:              parseFloat(data.price) || 0,
        stock:              parseInt(data.stock)   || 0,
        supplier:           data.supplier,
        manufacturer_price: parseFloat(data.manufacturerPrice) || 0,
        notes:              data.notes,
      };
      if (id) {
        result = await API.put(`/products/${id}`, payload);
        if (result?.success) {
          const idx = _cache.products.findIndex(p => p.id === id);
          if (idx > -1) _cache.products[idx] = { ..._cache.products[idx], ...payload };
        }
      } else {
        result = await API.post('/products', payload);
        if (result?.success) {
          _cache.products.unshift({ ...payload, id: result.id, createdAt: new Date().toISOString() });
        }
      }
      if (result?.success) {
        closeMgmtModal();
        showToast(result.message || 'Saved!');
        switchTab('products');
      } else {
        showToast(result?.message || 'Save failed.', true);
      }

    } else if (type === 'user') {
      const payload = {
        name:        data.name,
        email:       data.email,
        role:        data.role,
        designation: data.designation,
        password:    data.password || undefined,
      };
      const { password: _password, ...safeUserData } = payload;
      if (id) {
        result = await API.put(`/users/${id}`, payload);
        if (result?.success) {
          const idx = _cache.users.findIndex(u => u.id === id);
          if (idx > -1) _cache.users[idx] = { ..._cache.users[idx], ...safeUserData };
        }
      } else {
        // New user — call register
        result = await API.post('/auth/register', {
          username:    data.username,
          name:        data.name,
          email:       data.email,
          password:    data.password,
          role:        data.role,
          designation: data.designation,
        });
        if (result?.success) {
          // Refresh users cache
          const usersRes = await API.get('/users');
          if (usersRes?.success) _cache.users = _normalizeRows(usersRes.data);
        }
      }
      if (result?.success) {
        closeMgmtModal();
        showToast(result.message || 'User saved!');
        switchTab('sys-users');
      } else {
        showToast(result?.message || 'Save failed.', true);
      }
    }
  };


  // ── Patch deleteItem to call API ──────────────────────────
  window.deleteItem = async function(type, id) {
    if (!confirm('Delete this item? This cannot be undone.')) return;

    const routeMap = {
      products:  `/products/${id}`,
      customers: `/customers/${id}`,
      suppliers: `/suppliers/${id}`,
      orders:    `/orders/${id}`,
      users:     `/users/${id}`,
    };
    const route = routeMap[type];
    if (!route) return;

    const result = await API.del(route);
    if (result?.success) {
      // Remove from cache
      const cacheMap = {
        products:  'products',
        customers: 'customers',
        suppliers: 'suppliers',
        orders:    'orders',
        users:     'users',
      };
      const cacheKey = cacheMap[type];
      if (cacheKey) _cache[cacheKey] = _cache[cacheKey].filter(i => i.id !== id);

      showToast('Item deleted');
      const tabAfter = { products:'products', suppliers:'suppliers', customers:'customers', users:'sys-users', orders:'orders' };
      switchTab(tabAfter[type] || 'home');
    } else {
      showToast(result?.message || 'Delete failed.', true);
    }
  };


  // ── Patch handleOrderSubmit ───────────────────────────────
  window.handleOrderSubmit = async function(e) {
    e.preventDefault();
    const formData   = new FormData(e.target);
    const select     = document.getElementById('ord-prod');
    const custSel    = document.getElementById('ord-cust');

    if (!custSel.value) { showToast('Please select a customer!', true); return; }

    const opt  = select.options[select.selectedIndex];
    const qty  = parseInt(formData.get('qty')) || 1;
    const pId  = formData.get('productId');
    const price = parseFloat(opt?.getAttribute('data-p')) || 0;
    const dueTotal     = parseFloat(formData.get('dueTotal'))  || (price * qty);
    const duePaid      = parseFloat(formData.get('duePaid'))   || 0;
    const dueRemaining = Math.max(0, dueTotal - duePaid);

    const payload = {
      customerName:   custSel.value,
      productId:      pId,
      productName:    opt?.getAttribute('data-n') || '',
      qty,
      total:          (price * qty).toFixed(2),
      financeNameDue: formData.get('financeNameDue') || '',
      dueTotal:       dueTotal.toFixed(2),
      duePaid:        duePaid.toFixed(2),
      dueRemaining:   dueRemaining.toFixed(2),
    };

    const result = await API.post('/orders', payload);
    if (result?.success) {
      // Refresh cache
      const ordersRes = await API.get('/orders');
      if (ordersRes?.success) _cache.orders = _normalizeOrders(ordersRes.data);
      // Also refresh product stock in cache
      const productsRes = await API.get('/products');
      if (productsRes?.success) _cache.products = _normalizeRows(productsRes.data);

      closeMgmtModal();
      showToast('Order Created: ' + result.id);
      switchTab('orders');
    } else {
      showToast(result?.message || 'Failed to create order.', true);
    }
  };


  // ── Patch handleEditOrder (status change) ─────────────────
  window.handleEditOrder = async function(e, orderId) {
    e.preventDefault();
    const status = new FormData(e.target).get('status');

    const result = await API.put(`/orders/${orderId}/status`, { status });
    if (result?.success) {
      // Update cache
      const idx = _cache.orders.findIndex(o => o.id === orderId);
      if (idx > -1) {
        const prevStatus = _cache.orders[idx].status;
        _cache.orders[idx].status = status;
        if (status === 'Completed' && prevStatus !== 'Completed') {
          _cache.orders[idx].completedAt = new Date().toISOString();
          window.dispatchEvent(new CustomEvent('vavh-order-completed', { detail: _cache.orders[idx] }));
          showToast('✅ Revenue added to Finance Dashboard!');
        }
        if (prevStatus === 'Completed' && status !== 'Completed') {
          window.dispatchEvent(new CustomEvent('vavh-order-uncompleted', { detail: _cache.orders[idx] }));
        }
      }
      closeMgmtModal();
      showToast('Order status updated!');
      switchTab('orders');
    } else {
      showToast(result?.message || 'Update failed.', true);
    }
  };


  // ── Patch handleProfileUpdate ─────────────────────────────
  window.handleProfileUpdate = async function(e) {
    e.preventDefault();
    if (!currentUser) return;
    const name   = document.getElementById('prof-name').value.trim();
    const desig  = document.getElementById('prof-designation').value.trim();
    const pass   = document.getElementById('prof-pass').value;
    const rawSrc = document.getElementById('preview-avatar').src;
    const avatar = rawSrc.startsWith('data:') ? rawSrc : (currentUser.avatar || '');

    if (!name) { showToast('Name cannot be empty!', true); return; }

    const payload = { name, designation: desig, avatar };
    if (pass) payload.password = pass;

    const result = await API.put('/users/profile', payload);
    if (result?.success) {
      currentUser = result.user || { ...currentUser, name, designation: desig, avatar };
      Auth.updateSidebarUser(currentUser);
      closeMgmtModal();
      showToast('Profile updated!');
    } else {
      showToast(result?.message || 'Update failed.', true);
    }
  };


  // ── Patch quickSaveCustomer (inline customer creation in order modal) ──
  window.quickSaveCustomer = async function() {
    const name    = document.getElementById('qc-name')?.value?.trim();
    const contact = document.getElementById('qc-phone')?.value?.trim();
    const address = document.getElementById('qc-addr')?.value?.trim();

    if (!name || !contact) { showToast('Name and phone required!', true); return; }

    // Check local cache first
    if (_cache.customers.find(c => c.name.toLowerCase() === name.toLowerCase())) {
      showToast('Customer already exists!', true); return;
    }

    const result = await API.post('/customers', { name, contact, address: address || 'N/A' });
    if (result?.success) {
      const newCust = { id: result.id, name, contact, address: address || 'N/A', createdAt: new Date().toISOString() };
      _cache.customers.push(newCust);

      const sel = document.getElementById('ord-cust');
      if (sel) {
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name; opt.selected = true;
        sel.appendChild(opt);
      }
      document.getElementById('quick-cust-modal')?.remove();
      document.getElementById('mgmt-generic-modal')?.classList.remove('hidden');
      showToast('Customer created and selected!');
    } else {
      showToast(result?.message || 'Failed to create customer.', true);
    }
  };

  console.log('✅ Management form handlers patched');
}


/* ── 7. Patch Finance Module save functions ───────────────
   The Finance module objects (Investments, Expenses, etc.)
   each have a saveRecord() method. We override them to call
   the API before updating the cache.
─────────────────────────────────────────────────────────── */

function _patchFinanceModules() {

  // Helper: after saving to API, refresh a cache section
  async function _refreshFinCache(section) {
    const pathMap = {
      investments:     '/finance/investments',
      expenses:        '/finance/expenses',
      product_costs:   '/finance/product-costs',
      marketing:       '/finance/marketing',
      dealer_supplier: '/finance/dealer-supplier',
      due_records:     '/finance/due-tracking',
      functions:       '/finance/functions',
    };
    const path = pathMap[section];
    if (!path) return;
    const res = await API.get(path);
    if (res?.success) {
      if (section === 'product_costs')        _cache.product_costs  = _normalizeProductCosts(res.data);
      else if (section === 'dealer_supplier') _cache.dealer_supplier = _normalizeDealerSupplier(res.data);
      else if (section === 'due_records')     _cache.due_records     = _normalizeDueRecords(res.data);
      else if (section === 'functions')       _cache.fn_builder_functions = res.data;
      else _cache[section] = _normalizeFinRows(res.data);
    }
  }

  // ── Investments ─────────────────────────────────────
  if (typeof Investments !== 'undefined') {
    Investments.saveRecord = async function() {
      const form = document.getElementById('investmentForm');
      if (!form) return;
      const data = Object.fromEntries(new FormData(form).entries());
      const payload = {
        investor_name: data.investorName,
        amount:        parseFloat(data.amount) || 0,
        date:          data.date,
        method:        data.method || 'Cash',
        notes:         data.notes || '',
      };

      let result;
      if (this.editId) {
        result = await API.put(`/finance/investments/${this.editId}`, payload);
      } else {
        result = await API.post('/finance/investments', payload);
      }

      if (result?.success) {
        await _refreshFinCache('investments');
        FU.closeModal('investmentModal');
        FU.toast(result.message || 'Investment saved!', 'success');
        this.render();
      } else {
        FU.toast(result?.message || 'Save failed.', 'error');
      }
      this.editId = null;
    };

    Investments.delete = async function(id) {
      if (!Utils.confirmDelete(id)) return;
      const result = await API.del(`/finance/investments/${id}`);
      if (result?.success) {
        await _refreshFinCache('investments');
        FU.toast('Deleted.', 'info');
        this.render();
      } else {
        FU.toast(result?.message || 'Delete failed.', 'error');
      }
    };

    Investments.getData  = () => _cache.investments;
    Investments.saveData = () => {};
  }

      // ── Expenses ─────────────────────────────────────────
      if (typeof Expenses !== 'undefined') {
        Expenses.saveRecord = async function() {
          const form = document.getElementById('expenseForm');
          if (!form) return;
          const data = Object.fromEntries(new FormData(form).entries());
          const payload = {
            employee_name: data.employeeName,
            amount:        parseFloat(data.amount) || 0,
            date:          data.date,
            reason:        data.reason || '',
            attachment:    this.pendingFile || '',
          };

          let result;
          if (this.editId) {
            result = await API.put(`/finance/expenses/${this.editId}`, payload);
          } else {
            result = await API.post('/finance/expenses', payload);
          }

          if (result?.success) {
            await _refreshFinCache('expenses');
            FU.closeModal('expenseModal');
            FU.toast(result.message || 'Expense saved!', 'success');
            this.pendingFile = null;
            this.render();
          } else {
            FU.toast(result?.message || 'Save failed.', 'error');
          }
          this.editId = null;
        };

        Expenses.delete = async function(id) {
          if (!Utils.confirmDelete(id)) return;
          const result = await API.del(`/finance/expenses/${id}`);
          if (result?.success) {
            await _refreshFinCache('expenses');
            FU.toast('Deleted.', 'info');
            this.render();
          } else {
            FU.toast(result?.message || 'Delete failed.', 'error');
          }
        };

        Expenses.getData  = () => _cache.expenses;
        Expenses.saveData = () => {};
      }

      // ── Finance Product Costs ─────────────────────────────
      if (typeof FinProducts !== 'undefined') {
        FinProducts.saveRecord = async function() {
          const form = document.getElementById('productForm');
          if (!form) return;
          const data = Object.fromEntries(new FormData(form).entries());
          const payload = {
            product_name: data.productName,
            item_name:    data.itemName,
            supplier:     data.supplier || '',
            quantity:     parseInt(data.quantity) || 1,
            cost:         parseFloat(data.cost) || 0,
            date:         data.date,
            notes:        data.notes || '',
          };

          let result;
          if (this.editId) {
            result = await API.put(`/finance/product-costs/${this.editId}`, payload);
          } else {
            result = await API.post('/finance/product-costs', payload);
          }

          if (result?.success) {
            await _refreshFinCache('product_costs');
            FU.closeModal('productModal');
            FU.toast(result.message || 'Product cost saved!', 'success');
            this.render();
          } else {
            FU.toast(result?.message || 'Save failed.', 'error');
          }
          this.editId = null;
        };

        FinProducts.delete = async function(id) {
          if (!Utils.confirmDelete(id)) return;
          const result = await API.del(`/finance/product-costs/${id}`);
          if (result?.success) {
            await _refreshFinCache('product_costs');
            FU.toast('Deleted.', 'info');
            this.render();
          } else {
            FU.toast(result?.message || 'Delete failed.', 'error');
          }
        };

        FinProducts.getData  = () => _cache.product_costs;
        FinProducts.saveData = () => {};
      }

      // ── Marketing ─────────────────────────────────────────
      if (typeof Marketing !== 'undefined') {
        Marketing.saveRecord = async function() {
          const form = document.getElementById('marketingForm');
          if (!form) return;
          const data = Object.fromEntries(new FormData(form).entries());
          const payload = {
            platform:       data.platform,
            campaign_name:  data.campaignName || '',
            amount:         parseFloat(data.amount) || 0,
            date:           data.date,
            transaction_id: data.transactionId || '',
            notes:          data.notes || '',
          };

          let result;
          if (this.editId) {
            result = await API.put(`/finance/marketing/${this.editId}`, payload);
          } else {
            result = await API.post('/finance/marketing', payload);
          }

          if (result?.success) {
            await _refreshFinCache('marketing');
            FU.closeModal('marketingModal');
            FU.toast(result.message || 'Marketing record saved!', 'success');
            this.render();
          } else {
            FU.toast(result?.message || 'Save failed.', 'error');
          }
          this.editId = null;
        };

        Marketing.delete = async function(id) {
          if (!Utils.confirmDelete(id)) return;
          const result = await API.del(`/finance/marketing/${id}`);
          if (result?.success) {
            await _refreshFinCache('marketing');
            FU.toast('Deleted.', 'info');
            this.render();
          } else {
            FU.toast(result?.message || 'Delete failed.', 'error');
          }
        };

        Marketing.getData  = () => _cache.marketing;
        Marketing.saveData = () => {};
      }

      // ── Dealer / Supplier ─────────────────────────────────
      if (typeof DealerSupplier !== 'undefined') {
        DealerSupplier.saveRecord = async function() {
          const form = document.getElementById('dealerSupplierForm');
          if (!form) return;
          const data = Object.fromEntries(new FormData(form).entries());
          const payload = {
            supplier_name: data.supplierName,
            product:       data.product || '',
            amount:        parseFloat(data.amount) || 0,
            paid:          parseFloat(data.paid)   || 0,
            date:          data.date,
            status:        data.status || 'Pending',
            note:          data.note   || '',
          };

          let result;
          if (this.editId) {
            result = await API.put(`/finance/dealer-supplier/${this.editId}`, payload);
          } else {
            result = await API.post('/finance/dealer-supplier', payload);
          }

          if (result?.success) {
            await _refreshFinCache('dealer_supplier');
            FU.closeModal('dealerSupplierModal');
            FU.toast(result.message || 'Record saved!', 'success');
            this.render();
          } else {
            FU.toast(result?.message || 'Save failed.', 'error');
          }
          this.editId = null;
        };

        DealerSupplier.deleteRecord = async function(id) {
          const item = this.getData().find(d => d.id === id);
          if (!item || !Utils.confirmDelete(item.supplierName)) return;
          const result = await API.del(`/finance/dealer-supplier/${id}`);
          if (result?.success) {
            await _refreshFinCache('dealer_supplier');
            FU.toast('Deleted.', 'info');
            this.render();
          } else {
            FU.toast(result?.message || 'Delete failed.', 'error');
          }
        };

        // getData now reads from cache (already handled by Utils.lsGet override above)
        DealerSupplier.getData    = () => _cache.dealer_supplier;
        DealerSupplier.saveData   = () => {};  // no-op — use API instead
      }

      // ── Due Tracker ─────────────────────────────────────
      if (typeof DueTracker !== 'undefined') {
        DueTracker.saveStandalone = async function(rec) {
          let result;
          const payload = {
            party_name:       rec.partyName,
            description:      rec.description,
            finance_name_due: rec.financeNameDue,
            due_total:        rec.dueTotal,
            due_paid:         rec.duePaid,
            due_date:         rec.dueDate,
            due_status:       rec.dueStatus,
            notes:            rec.notes
          };

          if (rec.id && !rec.id.startsWith('DUE')) { // Existing DB record
            result = await API.put(`/finance/due-tracking/${rec.id}`, payload);
          } else {
            result = await API.post('/finance/due-tracking', payload);
          }

          if (result?.success) {
            await _refreshFinCache('due_records');
            FU.toast('Due record saved!', 'success');
            this.render();
          } else {
            FU.toast(result?.message || 'Save failed.', 'error');
          }
        };

        DueTracker.deleteStandalone = async function(id) {
          if (!confirm('Delete this record?')) return;
          const result = await API.del(`/finance/due-tracking/${id}`);
          if (result?.success) {
            await _refreshFinCache('due_records');
            FU.toast('Deleted.', 'info');
            this.render();
          } else {
            FU.toast(result?.message || 'Delete failed.', 'error');
          }
        };

        DueTracker.getStandalone = () => _cache.due_records;
        DueTracker.saveData = () => {};
      }

      // ── Function Builder ────────────────────────────────
      if (typeof FnBuilder !== 'undefined') {
        FnBuilder.save = async function() {
          const fn = this._current;
          if (!fn.name) return;

          let result;
          const payload = {
            name: fn.name,
            description: fn.description,
            category: fn.category,
            inputs: fn.inputs,
            steps: fn.steps,
            output_var: fn.output_var,
            output_label: fn.output_label,
            output_format: fn.output_format
          };

          if (fn.id && !fn.id.startsWith('FN')) {
            result = await API.put(`/finance/functions/${fn.id}`, payload);
          } else {
            result = await API.post('/finance/functions', payload);
          }

          if (result?.success) {
            await _refreshFinCache('functions');
            FU.toast('Function saved to cloud!', 'success');
            this.render();
          } else {
            FU.toast(result?.message || 'Save failed.', 'error');
          }
        };

        FnBuilder.delete = async function(id) {
          if (!confirm('Delete this function?')) return;
          const result = await API.del(`/finance/functions/${id}`);
          if (result?.success) {
            await _refreshFinCache('functions');
            FU.toast('Function deleted.', 'info');
            this.render();
          } else {
            FU.toast(result?.message || 'Delete failed.', 'error');
          }
        };
      }

      // ── Finance Dashboard — pull real stats from API ───────
      if (typeof FinDashboard !== 'undefined') {
        const _origFinDashInit = FinDashboard.init.bind(FinDashboard);
        FinDashboard.init = async function() {
          // Fetch live stats from server (avoids recalculating from potentially stale cache)
          const statsRes = await API.get('/finance/stats');
          if (statsRes?.success) {
            // Merge server stats into BalanceEngine so existing chart code works
            const s = statsRes.stats;
            if (typeof BalanceEngine !== 'undefined') {
              BalanceEngine._serverStats = s;
              // Override getCurrent to use server value
              BalanceEngine.getCurrent = () => s.finalBalance;
              BalanceEngine.computeAuto = () => ({
                tI: s.tI, tE: s.tE, tP: s.tP, tM: s.tM, tOR: s.tOR
              });
              BalanceEngine.hasManual = () => s.isManualBalance;
            }
          }
          // Call original init to render the dashboard UI
          _origFinDashInit();
        };
      }

      // ── UserMgmt.save — create/update user from Finance module ──
      if (typeof UserMgmt !== 'undefined') {
        UserMgmt.save = async function() {
          const nameEl  = document.getElementById('uFormName');
          const userEl  = document.getElementById('uFormUsername');
          const passEl  = document.getElementById('uFormPassword');
          const roleEl  = document.getElementById('uFormRole');
          const notesEl = document.getElementById('uFormNotes');

          const name     = nameEl?.value.trim();
          const username = userEl?.value.trim();
          const password = passEl?.value;
          const role     = roleEl?.value || 'user';
          const notes    = notesEl?.value.trim();

          if (!name || !username) {
            FU.toast('Name and username are required.', 'error'); return;
          }

          const payload = { name, username, password, role, designation: notes };

          let result;
          if (this.editId) {
            result = await API.put(`/users/${this.editId}`, payload);
          } else {
            if (!password) { FU.toast('Password is required for new users.', 'error'); return; }
            result = await API.post('/auth/register', payload);
          }

          if (result?.success) {
            // Refresh users cache
            const usersRes = await API.get('/users');
            if (usersRes?.success) _cache.users = _normalizeRows(usersRes.data);
            FU.closeModal('userModal');
            FU.toast(result.message || 'User saved!', 'success');
            if (typeof finNavigate === 'function') finNavigate('users');
          } else {
            FU.toast(result?.message || 'Save failed.', 'error');
          }
          this.editId = null;
        };

        UserMgmt.delete = async function(id) {
          if (!confirm('Delete this user?')) return;
          const result = await API.del(`/users/${id}`);
          if (result?.success) {
            _cache.users = _cache.users.filter(u => u.id !== id);
            FU.toast('User deleted.', 'info');
            if (typeof finNavigate === 'function') finNavigate('users');
          } else {
            FU.toast(result?.message || 'Delete failed.', 'error');
          }
        };
      }

  console.log('✅ Finance module handlers patched');
}


/* ── 8. Chat: use cache (localStorage-like) but optionally sync ──
   Chat is a real-time feature — for simplicity we keep it in
   memory for this session. If you want multi-user real-time chat,
   add WebSocket support later.
─────────────────────────────────────────────────────────── */

// No changes needed — chat already writes to Utils.getData('chats') / ('messages')
// which now write to _cache.chats / _cache.messages (in-memory for the session).


/* ── 9. Inventory Adjustments: patch saveAdjustment ─────── */

function _patchInventory() {
  if (typeof Inventory !== 'undefined') {
    const _origSave = Inventory.saveAdjustment.bind(Inventory);
    Inventory.saveAdjustment = async function() {
      const form = document.getElementById('inventoryForm');
      if (!form) return _origSave();

      const data = Object.fromEntries(new FormData(form).entries());
      const payload = {
        product_id:   data.productId,
        product_name: data.productName,
        adj_type:     data.adjType,
        qty:          parseInt(data.qty) || 0,
        reference:    data.reference || '',
        note:         data.note || '',
        date:         data.date || Utils.today()
      };

      const result = await API.post('/finance/inventory-adjustments', payload);
      if (result?.success) {
        // Refresh cache
        const resAdj = await API.get('/finance/inventory-adjustments');
        if (resAdj?.success) _cache.inventory_adjustments = _normalizeInventoryAdj(resAdj.data);
        
        const resProd = await API.get('/products');
        if (resProd?.success) _cache.products = _normalizeRows(resProd.data);

        FU.closeModal('inventoryAdjModal');
        FU.toast('Stock adjustment saved!', 'success');
        this.render();
      } else {
        FU.toast(result?.message || 'Adjustment failed.', 'error');
      }
    };
  }
}


/* ── 10. Boot sequence ────────────────────────────────────
   Everything is deferred until after the page's own scripts
   have had a chance to define their objects (Utils, Auth, etc.)
─────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Wait one tick so all inline <script> blocks have executed
  setTimeout(() => {
    _patchUtils();
    _patchAuth();
    _patchManagementForms();
    _patchFinanceModules();
    _patchInventory();

    console.log('🚀 V.A.V.H API bridge ready — all modules connected to MySQL backend');

    // Now trigger the original app boot (checkSession)
    // The original DOMContentLoaded already called Auth.checkSession(),
    // but since we replaced it with the async version, we call it again
    // to ensure it runs with the patched implementation.
    // (The original call became a no-op during the first tick before patching)
    Auth.checkSession();

  }, 0);
});
