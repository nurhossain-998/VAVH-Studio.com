/* ============================================================
   js/utils/storage.js — localStorage Helpers for VAVH.Studio
   Typed wrappers for cart, wishlist, token, and user data
   ============================================================ */

const Storage = {

  /* ── Token ─────────────────────────────────────────────── */

  // Save JWT token to localStorage
  setToken(token) {
    localStorage.setItem(window.VAVH.TOKEN_KEY, token);
  },

  // Retrieve stored JWT token (null if absent)
  getToken() {
    return localStorage.getItem(window.VAVH.TOKEN_KEY);
  },

  // Remove JWT token (used on logout)
  removeToken() {
    localStorage.removeItem(window.VAVH.TOKEN_KEY);
  },

  /* ── User ───────────────────────────────────────────────── */

  // Save user object as JSON string
  setUser(user) {
    localStorage.setItem(window.VAVH.USER_KEY, JSON.stringify(user));
  },

  // Retrieve and parse user object (null if absent)
  getUser() {
    const raw = localStorage.getItem(window.VAVH.USER_KEY);
    // Guard against invalid JSON in storage
    try { return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  },

  // Remove user data (used on logout)
  removeUser() {
    localStorage.removeItem(window.VAVH.USER_KEY);
  },

  // Check if a user is currently authenticated
  isLoggedIn() {
    return !!(this.getToken() && this.getUser());
  },

  /* ── Cart ───────────────────────────────────────────────── */

  // Retrieve cart array from localStorage
  getCart() {
    const raw = localStorage.getItem(window.VAVH.CART_KEY);
    try { return raw ? JSON.parse(raw) : []; }
    catch { return []; }
  },

  // Persist cart array to localStorage
  setCart(cart) {
    localStorage.setItem(window.VAVH.CART_KEY, JSON.stringify(cart));
  },

  // Add an item to the local cart, merging quantity if duplicate
  addToCart(product, quantity = 1, comment = '') {
    const cart = this.getCart();
    // Find existing cart entry for this product
    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      // Increase quantity if already in cart
      existing.quantity += quantity;
    } else {
      // Add new item entry
      cart.push({
        product_id: product.id,
        name:       product.name,
        price:      product.price,
        image:      product.image_url,
        quantity,
        comment,
      });
    }
    this.setCart(cart);
    return cart;
  },

  // Remove an item from local cart by product ID
  removeFromCart(productId) {
    const cart = this.getCart().filter(item => item.product_id !== productId);
    this.setCart(cart);
    return cart;
  },

  // Clear the entire cart
  clearCart() {
    localStorage.removeItem(window.VAVH.CART_KEY);
  },

  // Get total number of items (sum of quantities) in cart
  getCartCount() {
    return this.getCart().reduce((sum, item) => sum + item.quantity, 0);
  },

  // Get total cart value in currency units
  getCartTotal() {
    return this.getCart().reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  /* ── Wishlist ───────────────────────────────────────────── */

  // Retrieve wishlist array (product IDs)
  getWishlist() {
    const raw = localStorage.getItem(window.VAVH.WISHLIST_KEY);
    try { return raw ? JSON.parse(raw) : []; }
    catch { return []; }
  },

  // Save wishlist array
  setWishlist(list) {
    localStorage.setItem(window.VAVH.WISHLIST_KEY, JSON.stringify(list));
  },

  // Toggle a product in/out of wishlist; returns new wishlist
  toggleWishlist(productId) {
    const list = this.getWishlist();
    const idx = list.indexOf(productId);
    if (idx > -1) {
      // Remove if already wishlisted
      list.splice(idx, 1);
    } else {
      // Add if not wishlisted
      list.push(productId);
    }
    this.setWishlist(list);
    return list;
  },

  // Check if a product is in the wishlist
  isWishlisted(productId) {
    return this.getWishlist().includes(productId);
  },

  /* ── Full logout cleanup ────────────────────────────────── */

  // Clear all auth and session data on logout
  logout() {
    this.removeToken();
    this.removeUser();
    // Optionally keep cart for guest continuation
  },
};

// Expose globally
window.Storage = Storage;
