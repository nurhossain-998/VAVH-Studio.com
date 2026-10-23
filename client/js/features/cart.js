/* ============================================================
   js/features/cart.js — Cart State & Drawer UI for VAVH.Studio
   Manages local cart storage, drawer rendering, checkout
   ============================================================ */

const Cart = {

  // ── Initialise cart on page load ───────────────────────────

  init() {
    // Bind cart overlay close button
    const closeBtn = document.getElementById('cartClose');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // Close cart when clicking the dark overlay (not the panel itself)
    const overlay = document.getElementById('cartOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        // Only close if click is directly on overlay, not the panel
        if (e.target === overlay) this.close();
      });
    }

    // Checkout button — place order via API
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', () => this.checkout());

    // Render initial cart state
    this.render();

    // Populate the inline customer form when the cart appears
    this.populateCustomerForm();
  },

  // ── Add an item to cart ────────────────────────────────────

  /**
   * Add a product to the cart.
   * @param {object} product   - Product object with id, name, price, image_url
   * @param {number} qty       - Quantity to add (default 1)
   * @param {string} comment   - Optional order note
   */
  addItem(product, qty = 1, comment = '') {
    // Guard: must be logged in to add to cart (can change to guest cart)
    if (!window.Storage.isLoggedIn()) {
      window.Toast.info('Please sign in to add items to your cart.');
      setTimeout(() => window.location.href = 'login.html', 1200);
      return;
    }

    // Add to local storage cart
    window.Storage.addToCart(product, qty, comment);
    window.VavhAnalytics?.track('add_to_cart', product);

    // Re-render cart drawer
    this.render();

    // Show toast confirmation
    window.Toast.success(`${product.name} added to cart`);

    // Open the cart drawer to show the item
    this.open();

    // Fire custom event so navbar badge updates
    document.dispatchEvent(new CustomEvent('cartUpdated'));
  },

  // ── Remove an item from cart ──────────────────────────────

  removeItem(productId) {
    window.Storage.removeFromCart(productId);
    this.render();
    document.dispatchEvent(new CustomEvent('cartUpdated'));
  },

  // ── Render cart drawer contents ────────────────────────────

  render() {
    const itemsContainer = document.getElementById('cartItems');
    const footerEl       = document.getElementById('cartFooter');
    const emptyEl        = document.getElementById('cartEmpty');
    const totalEl        = document.getElementById('cartTotal');

    if (!itemsContainer) return;

    const cart = window.Storage.getCart();

    if (cart.length === 0) {
      // Show empty state
      if (emptyEl) emptyEl.style.display = 'flex';
      if (footerEl) footerEl.style.display = 'none';
      // Clear any previously rendered items
      const existingItems = itemsContainer.querySelectorAll('.cart-item');
      existingItems.forEach(item => item.remove());
      return;
    }

    // Hide empty state, show footer
    if (emptyEl) emptyEl.style.display = 'none';
    if (footerEl) footerEl.style.display = 'block';

    // Update total price display
    if (totalEl) totalEl.textContent = window.Helpers.formatPrice(window.Storage.getCartTotal());

    // Clear previous items (except empty state element)
    itemsContainer.querySelectorAll('.cart-item').forEach(el => el.remove());

    // Build and append each cart item row
    cart.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item';
      itemEl.dataset.productId = item.product_id;

      itemEl.innerHTML = `
        <!-- Product thumbnail -->
        <img
          src="${window.Helpers.productImage(item.image)}"
          alt="${item.name}"
          class="cart-item__img"
          loading="lazy"
        />
        <!-- Item info -->
        <div class="cart-item__info">
          <p class="cart-item__name">${item.name}</p>
          <p class="cart-item__price">${window.Helpers.formatPrice(item.price)} × ${item.quantity}</p>
          ${item.comment ? `<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px;">${item.comment}</p>` : ''}
        </div>
        <!-- Remove button -->
        <button class="cart-item__remove" aria-label="Remove ${item.name}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      `;

      // Remove button click handler
      itemEl.querySelector('.cart-item__remove').addEventListener('click', () => {
        this.removeItem(item.product_id);
      });

      itemsContainer.appendChild(itemEl);
    });
  },

  // ── Open cart drawer ──────────────────────────────────────

  open() {
    const overlay = document.getElementById('cartOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    this.populateCustomerForm();
    // Prevent body scroll while drawer is open
    document.body.style.overflow = 'hidden';
  },

  // ── Close cart drawer ─────────────────────────────────────

  close() {
    const overlay = document.getElementById('cartOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  },

  // ── Checkout — place order via API ────────────────────────

  getCustomerFormElements() {
    return {
      section: document.getElementById('cartCustomerSection'),
      name: document.getElementById('cartCustomerName'),
      email: document.getElementById('cartCustomerEmail'),
      phone: document.getElementById('cartCustomerPhone'),
      address: document.getElementById('cartCustomerAddress'),
    };
  },

  getDefaultCustomerDetails() {
    const user = window.Storage.getUser();
    const fullName = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '';

    return {
      name: fullName,
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.address || '',
    };
  },

  populateCustomerForm() {
    const elements = this.getCustomerFormElements();
    if (!elements.section) return;

    const defaults = this.getDefaultCustomerDetails();
    elements.name.value = elements.name.value || defaults.name;
    elements.email.value = elements.email.value || defaults.email;
    elements.phone.value = elements.phone.value || defaults.phone;
    elements.address.value = elements.address.value || defaults.address;
    elements.section.style.display = 'grid';
  },

  readCustomerFormData() {
    const elements = this.getCustomerFormElements();
    if (!elements.name) {
      return this.getDefaultCustomerDetails();
    }

    return {
      name: elements.name.value.trim(),
      email: elements.email.value.trim(),
      phone: elements.phone.value.trim(),
      address: elements.address.value.trim(),
    };
  },

  validateCustomerFormData(data) {
    const missing = [];
    if (!data.name) missing.push('name');
    if (!data.email || !window.Helpers.isValidEmail(data.email)) missing.push('email');
    if (!data.phone) missing.push('phone');
    return { isValid: missing.length === 0, missing };
  },

  clearCustomerErrors() {
    const elements = this.getCustomerFormElements();
    if (!elements.name) return;
    [elements.name, elements.email, elements.phone].forEach(input => {
      input?.classList.remove('error');
    });
  },

  markCustomerErrors(missing) {
    const elements = this.getCustomerFormElements();
    if (!elements.name) return;

    const map = {
      name: elements.name,
      email: elements.email,
      phone: elements.phone,
    };

    missing.forEach(field => {
      map[field]?.classList.add('error');
    });
  },

  async placeOrder(customerDetails) {
    const cart = window.Storage.getCart();
    if (cart.length === 0) return;

    const payload = {
      items: cart.map(item => ({
        product_id: item.product_id,
        quantity:   item.quantity,
        comment:    item.comment || '',
      })),
      total: window.Storage.getCartTotal(),
      customer: customerDetails,
      analyticsSessionId: window.VavhAnalytics?.sessionId(),
    };

    const result = await window.api.post('/orders', payload);
    const orderLabel = result.order_reference || result.order_id;

    window.Toast.success(`Order #${orderLabel} placed successfully! 🎉`);

    window.Storage.clearCart();
    this.render();
    this.close();

    document.dispatchEvent(new CustomEvent('cartUpdated'));

    setTimeout(() => {
      window.location.href = 'dashboard.html#orders';
    }, 1800);
  },

  async checkout() {
    window.VavhAnalytics?.track('checkout_started');
    const cart = window.Storage.getCart();
    if (cart.length === 0) return;

    this.clearCustomerErrors();
    const customer = this.readCustomerFormData();
    const validation = this.validateCustomerFormData(customer);

    if (!validation.isValid) {
      this.markCustomerErrors(validation.missing);
      window.Toast.error('Please fill in all required customer fields before checkout.');
      return;
    }

    try {
      await this.placeOrder(customer);
    } catch (err) {
      window.Toast.error(err.message || 'Could not place order. Please try again.');
    }
  },
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => Cart.init());

// Expose globally
window.Cart = Cart;
