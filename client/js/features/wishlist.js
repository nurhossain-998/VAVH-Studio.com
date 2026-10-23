/* ============================================================
   js/features/wishlist.js — Wishlist Toggle for VAVH.Studio
   ============================================================ */

const Wishlist = {
  /**
   * Toggle a product in/out of wishlist and update button UI.
   * @param {object}      product  - Product object
   * @param {HTMLElement} btnEl    - The wishlist button element to update
   */
  toggle(product, btnEl) {
    // Require login to save wishlist (persisted to API if logged in)
    if (!window.Storage.isLoggedIn()) {
      window.Toast.info('Sign in to save items to your wishlist.');
      return;
    }

    // Toggle in local storage
    const list = window.Storage.toggleWishlist(product.id);
    const isNowWishlisted = list.includes(product.id);

    // Update button visual state
    if (btnEl) {
      btnEl.classList.toggle('active', isNowWishlisted);
      const svgEl = btnEl.querySelector('svg');
      if (svgEl) svgEl.setAttribute('fill', isNowWishlisted ? 'currentColor' : 'none');
      btnEl.setAttribute('aria-label', isNowWishlisted ? 'Remove from wishlist' : 'Add to wishlist');
    }

    // Show feedback toast
    if (isNowWishlisted) {
      window.Toast.success(`${product.name} added to wishlist`);
    } else {
      window.Toast.info(`${product.name} removed from wishlist`);
    }

    // Sync wishlist to API asynchronously (fire and forget)
    this.syncToApi(product.id, isNowWishlisted);

    // Notify navbar badge to update
    document.dispatchEvent(new CustomEvent('wishlistUpdated'));
  },

  // Sync wishlist action to backend API
  async syncToApi(productId, add) {
    try {
      if (add) {
        await window.api.post('/wishlist', { product_id: productId });
      } else {
        await window.api.delete(`/wishlist/${productId}`);
      }
    } catch {
      // Silent fail — local state is still valid
    }
  },
};

window.Wishlist = Wishlist;


/* ============================================================
   js/features/auth.js — Auth State Management for VAVH.Studio
   ============================================================ */

const Auth = {
  // Check if user is logged in; redirect if required page
  check(required = false) {
    const loggedIn = window.Storage.isLoggedIn();
    if (required && !loggedIn) {
      // Save intended URL for post-login redirect
      sessionStorage.setItem('redirect_after_login', window.location.href);
      window.location.href = 'login.html';
      return false;
    }
    return loggedIn;
  },

  // Log out the current user
  logout() {
    window.Storage.logout();
    window.Toast.info('You have been signed out.');
    setTimeout(() => window.location.href = 'index.html', 800);
  },

  // Redirect to saved URL or default after login
  redirectAfterLogin() {
    const saved = sessionStorage.getItem('redirect_after_login');
    sessionStorage.removeItem('redirect_after_login');
    window.location.href = saved || 'index.html';
  },
};

window.Auth = Auth;


/* ============================================================
   js/features/orders.js — Order Helpers for VAVH.Studio
   ============================================================ */

const Orders = {
  // Fetch all orders for the current user
  async fetchMyOrders() {
    return await window.api.get('/orders/my');
  },

  // Fetch a single order by ID
  async fetchOrder(orderId) {
    return await window.api.get(`/orders/${orderId}`);
  },

  // Build order status badge HTML
  statusBadge(status) {
    const map = window.VAVH.ORDER_STATUS;
    const s = map[status] || { label: status, class: 'badge-neutral' };
    return `<span class="badge ${s.class}">${s.label}</span>`;
  },

  // Build tracking timeline steps HTML
  trackingSteps(status) {
    const steps = [
      { key: 'pending',    label: 'Order Placed',     desc: 'Your order has been received.' },
      { key: 'processing', label: 'Processing',       desc: 'We\'re preparing your items.' },
      { key: 'shipped',    label: 'Shipped',          desc: 'Your order is on its way.' },
      { key: 'delivered',  label: 'Delivered',        desc: 'Delivered successfully. Enjoy!' },
    ];

    const statusOrder = ['pending','processing','shipped','delivered'];
    const currentIdx  = statusOrder.indexOf(status);

    return steps.map((step, i) => {
      const isCompleted = i < currentIdx;
      const isActive    = i === currentIdx;
      return `
        <div class="tracking-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}">
          <div class="tracking-step__dot"></div>
          <div>
            <p style="font-weight:var(--fw-medium);font-size:var(--text-sm);">${step.label}</p>
            <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px;">${step.desc}</p>
          </div>
        </div>
      `;
    }).join('');
  },
};

window.Orders = Orders;
