/* ============================================================
   js/pages/dashboard.js — Customer Dashboard Logic for VAVH.Studio
   Tabs: overview, orders, delivered, wishlist, profile edit
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {

  // Require authentication — redirect to login if not logged in
  if (!window.Auth.check(true)) return;

  // ── DOM references ─────────────────────────────────────────
  const contentArea  = document.getElementById('dashContent');
  const greetingEl   = document.getElementById('dashGreeting');
  const avatarEl     = document.getElementById('userAvatar');
  const nameEl       = document.getElementById('sidebarUserName');
  const emailEl      = document.getElementById('sidebarUserEmail');
  const logoutBtn    = document.getElementById('sidebarLogout');
  const navBtns      = document.querySelectorAll('[data-tab]');

  // ── Load user data ─────────────────────────────────────────
  const user = window.Storage.getUser();

  // Update greeting and sidebar user info
  if (greetingEl) greetingEl.textContent = `Hello, ${user?.name?.split(' ')[0] || 'there'} 👋`;
  if (avatarEl)   avatarEl.textContent   = window.Helpers.getInitials(user?.name || '');
  if (nameEl)     nameEl.textContent     = user?.name || '';
  if (emailEl)    emailEl.textContent    = user?.email || '';

  // ── Logout handler ─────────────────────────────────────────
  logoutBtn?.addEventListener('click', () => window.Auth.logout());
  document.getElementById('navLoginBtn')?.addEventListener('click', () => window.Auth.logout());
  // ── Admin panel button handler ──────────────────────────
  const adminLinks = document.querySelectorAll('.admin-link-item');
  if (adminLinks.length > 0) {
    if (user?.role === 'admin' || user?.role === 'Admin' || user?.role === 'Super Admin') {
      adminLinks.forEach(link => link.style.display = 'flex');
    }
  }
  // ── Tab system ─────────────────────────────────────────────

  // Currently active tab
  let currentTab = 'overview';

  // Switch to a tab and load its content
  async function switchTab(tabName) {
    currentTab = tabName;

    // Update sidebar active state
    navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));

    // Show loading spinner in content area
    contentArea.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>`;

    // Render the selected tab
    switch (tabName) {
      case 'overview':  await renderOverview();  break;
      case 'orders':    await renderOrders();    break;
      case 'delivered': await renderDelivered(); break;
      case 'wishlist':  await renderWishlist();  break;
      case 'profile':   renderProfile();          break;
    }
  }

  // Handle tab button clicks
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Handle hash-based tab (e.g. dashboard.html#orders)
  const hash = window.location.hash.replace('#', '');
  const initialTab = ['overview','orders','delivered','wishlist','profile'].includes(hash)
    ? hash : 'overview';

  // ── Tab: Overview ──────────────────────────────────────────

  async function renderOverview() {
    try {
      // Fetch summary stats for current user
      const stats = await window.api.get('/users/stats');

      contentArea.innerHTML = `
        <!-- Stats grid -->
        <div class="stats-grid reveal">
          <div class="stat-card">
            <div class="stat-card__number">${stats.total_orders || 0}</div>
            <div class="stat-card__label">Total Orders</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__number">${stats.delivered || 0}</div>
            <div class="stat-card__label">Delivered</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__number">${stats.wishlist_count || 0}</div>
            <div class="stat-card__label">Wishlist Items</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__number">${window.Helpers.formatPrice(stats.total_spent || 0)}</div>
            <div class="stat-card__label">Total Spent</div>
          </div>
        </div>

        <!-- Recent orders section -->
        <div style="margin-top:var(--space-8);">
          <h2 style="font-family:var(--font-display);font-size:var(--text-xl);margin-bottom:var(--space-5);">Recent Orders</h2>
          <div id="recentOrdersList"></div>
        </div>
      `;

      // Load and display recent 3 orders
      const orders = await window.Orders.fetchMyOrders();
      const recentEl = document.getElementById('recentOrdersList');
      if (recentEl) renderOrderRows(orders.slice(0, 3), recentEl);

      if (window.ScrollReveal) window.ScrollReveal.refresh();
    } catch {
      contentArea.innerHTML = `<div class="empty-state"><h3>Could not load overview</h3></div>`;
    }
  }

  // ── Tab: All Orders ────────────────────────────────────────

  async function renderOrders() {
    try {
      const orders = await window.Orders.fetchMyOrders();
      contentArea.innerHTML = `
        <h2 style="font-family:var(--font-display);font-size:var(--text-xl);margin-bottom:var(--space-6);">My Orders</h2>
        <div id="allOrdersList"></div>
      `;
      const listEl = document.getElementById('allOrdersList');
      renderOrderRows(orders, listEl);
    } catch {
      contentArea.innerHTML = `<div class="empty-state"><h3>Could not load orders</h3></div>`;
    }
  }

  // ── Tab: Delivered ─────────────────────────────────────────

  async function renderDelivered() {
    try {
      const orders = await window.Orders.fetchMyOrders();
      const delivered = orders.filter(o => o.status === 'delivered');
      contentArea.innerHTML = `
        <h2 style="font-family:var(--font-display);font-size:var(--text-xl);margin-bottom:var(--space-6);">Delivered Orders</h2>
        <div id="deliveredList"></div>
      `;
      const listEl = document.getElementById('deliveredList');
      if (delivered.length === 0) {
        listEl.innerHTML = `<div class="empty-state"><h3>No delivered orders yet</h3></div>`;
      } else {
        renderOrderRows(delivered, listEl, true);
      }
    } catch {
      contentArea.innerHTML = `<div class="empty-state"><h3>Could not load delivered orders</h3></div>`;
    }
  }

  // ── Tab: Wishlist ──────────────────────────────────────────

  async function renderWishlist() {
    contentArea.innerHTML = `
      <h2 style="font-family:var(--font-display);font-size:var(--text-xl);margin-bottom:var(--space-6);">My Wishlist</h2>
      <div class="products-grid" id="wishlistGrid"></div>
    `;
    try {
      const data = await window.api.get('/wishlist');
      const grid = document.getElementById('wishlistGrid');
      if (data.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>Your wishlist is empty</h3><a href="products.html" class="btn btn-primary" style="margin-top:var(--space-4);">Browse Products</a></div>`;
      } else {
        window.renderProductGrid(grid, data);
      }
    } catch {
      document.getElementById('wishlistGrid').innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>Could not load wishlist</h3></div>`;
    }
  }

  // ── Tab: Profile Edit ──────────────────────────────────────

  function renderProfile() {
    const u = window.Storage.getUser() || {};
    const escapeHtml = window.Helpers.escapeHtml;
    contentArea.innerHTML = `
      <h2 style="font-family:var(--font-display);font-size:var(--text-xl);margin-bottom:var(--space-6);">Edit Profile</h2>
      <div style="background:var(--glass-card);border:1px solid var(--glass-border);border-radius:var(--radius-xl);padding:var(--space-8);max-width:600px;">
        <form id="profileForm" class="flex-stack">
          <div class="form-grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5);">
            <div class="form-group">
              <label class="form-label" for="pName">Full Name</label>
              <input type="text" id="pName" class="form-input" value="${escapeHtml(u.name)}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="pPhone">Phone</label>
              <input type="tel" id="pPhone" class="form-input" value="${escapeHtml(u.phone)}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="pEmail">Email</label>
            <input type="email" id="pEmail" class="form-input" value="${escapeHtml(u.email)}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="pAddress">Delivery Address</label>
            <input type="text" id="pAddress" class="form-input" value="${escapeHtml(u.address)}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="pNewPass">New Password <span style="color:var(--color-text-muted);font-weight:400;">(leave blank to keep current)</span></label>
            <input type="password" id="pNewPass" class="form-input" placeholder="New password (optional)" />
          </div>
          <div style="display:flex;gap:var(--space-3);">
            <button type="submit" class="btn btn-primary" id="profileSaveBtn">Save Changes</button>
            <button type="button" class="btn btn-ghost" onclick="window.Auth.logout()">Sign Out</button>
          </div>
          <p class="form-error hidden" id="profileError" role="alert"></p>
          <p class="text-center hidden" id="profileSuccess" style="color:var(--color-success);font-size:var(--text-sm);">Profile updated successfully!</p>
        </form>
      </div>
    `;

    // Profile form submit
    document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('profileSaveBtn');
      const errEl   = document.getElementById('profileError');
      const okEl    = document.getElementById('profileSuccess');

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      const payload = {
        name:    document.getElementById('pName').value.trim(),
        phone:   document.getElementById('pPhone').value.trim(),
        email:   document.getElementById('pEmail').value.trim(),
        address: document.getElementById('pAddress').value.trim(),
      };
      const newPass = document.getElementById('pNewPass').value;
      if (newPass) payload.password = newPass;

      try {
        const updated = await window.api.put('/users/profile', payload);
        // Update locally stored user data
        window.Storage.setUser({ ...u, ...updated.user });
        nameEl.textContent = updated.user.name;
        okEl.classList.remove('hidden');
        errEl.classList.add('hidden');
        setTimeout(() => okEl.classList.add('hidden'), 3000);
      } catch (err) {
        errEl.textContent = err.message || 'Update failed.';
        errEl.classList.remove('hidden');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    });
  }

  // ── Render order rows helper ───────────────────────────────

  function renderOrderRows(orders, container, showRepurchase = false) {
    if (!container) return;
    if (!orders || orders.length === 0) {
      container.innerHTML = `<div class="empty-state"><h3>No orders yet</h3><a href="products.html" class="btn btn-outline" style="margin-top:var(--space-4);">Start Shopping</a></div>`;
      return;
    }

    const escapeHtml = window.Helpers.escapeHtml;
    container.innerHTML = orders.map(order => `
      <div class="order-row">
        <div>
          <p style="font-weight:var(--fw-medium);font-size:var(--text-sm);">Order #${escapeHtml(order.id)}</p>
          <p style="font-size:var(--text-xs);color:var(--color-text-muted);">${window.Helpers.formatDate(order.created_at)}</p>
        </div>
        <div class="order-col-hide-mobile">
          <p style="font-size:var(--text-sm);">${escapeHtml(order.item_count || 1)} item${order.item_count !== 1 ? 's' : ''}</p>
        </div>
        <div>${window.Orders.statusBadge(order.status)}</div>
        <div class="order-col-hide-mobile">
          <p style="font-weight:var(--fw-semi);font-size:var(--text-sm);">${window.Helpers.formatPrice(order.total)}</p>
        </div>
        <div style="display:flex;gap:var(--space-2);">
          <button class="btn btn-ghost btn-sm track-btn" data-order-id="${escapeHtml(order.id)}" data-status="${escapeHtml(order.status)}">Track</button>
          ${showRepurchase ? `<button class="btn btn-outline btn-sm repurchase-btn" data-order-id="${escapeHtml(order.id)}">Reorder</button>` : ''}
        </div>
      </div>
    `).join('');

    // Track button click → open tracking modal
    container.querySelectorAll('.track-btn').forEach(btn => {
      btn.addEventListener('click', () => openTrackingModal(btn.dataset.orderId, btn.dataset.status));
    });

    // Repurchase button click → re-add items to cart
    container.querySelectorAll('.repurchase-btn').forEach(btn => {
      btn.addEventListener('click', () => repurchaseOrder(btn.dataset.orderId));
    });
  }

  // ── Order tracking modal ───────────────────────────────────

  function openTrackingModal(orderId, status) {
    const overlay  = document.getElementById('trackingModalOverlay');
    const stepsEl  = document.getElementById('trackingSteps');
    const orderIdEl = document.getElementById('trackingOrderId');

    if (!overlay) return;
    if (orderIdEl) orderIdEl.textContent = `#${orderId}`;
    if (stepsEl)   stepsEl.innerHTML = window.Orders.trackingSteps(status);

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Close button
    document.getElementById('trackingModalClose')?.addEventListener('click', () => {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }, { once: true });
  }

  // ── Repurchase order ───────────────────────────────────────

  async function repurchaseOrder(orderId) {
    try {
      const order = await window.Orders.fetchOrder(orderId);
      // Add each order item back to cart
      if (order.items) {
        order.items.forEach(item => {
          window.Storage.addToCart({
            id:        item.product_id,
            name:      item.product_name,
            price:     item.price,
            image_url: item.image_url,
          }, item.quantity);
        });
        document.dispatchEvent(new CustomEvent('cartUpdated'));
        window.Toast.success('Items added to cart for reorder!');
        if (window.Cart) window.Cart.open();
      }
    } catch {
      window.Toast.error('Could not reorder. Please try again.');
    }
  }

  // ── Initialize: load initial tab ──────────────────────────
  await switchTab(initialTab);
});
