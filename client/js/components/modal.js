/* ============================================================
   js/components/modal.js — Product Detail Modal for VAVH.Studio
   Opens a glassmorphism popup with product info + add to cart
   ============================================================ */

const ProductModal = {
  // Currently displayed product data
  currentProduct: null,

  // DOM element references
  overlay:      null,
  modal:        null,
  closeBtn:     null,
  imgEl:        null,
  titleEl:      null,
  nameEl:       null,
  categoryEl:   null,
  priceEl:      null,
  descEl:       null,
  commentEl:    null,
  addToCartBtn: null,
  wishlistBtn:  null,

  // Initialize — get DOM references and bind events
  init() {
    this.overlay      = document.getElementById('productModalOverlay');
    this.modal        = document.getElementById('productModal');
    this.closeBtn     = document.getElementById('productModalClose');
    this.imgEl        = document.getElementById('productModalImg');
    this.titleEl      = document.getElementById('productModalTitle');
    this.nameEl       = document.getElementById('productModalName');
    this.categoryEl   = document.getElementById('productModalCategory');
    this.priceEl      = document.getElementById('productModalPrice');
    this.descEl       = document.getElementById('productModalDesc');
    this.commentEl    = document.getElementById('purchaseComment');
    this.addToCartBtn = document.getElementById('modalAddToCartBtn');
    this.wishlistBtn  = document.getElementById('modalWishlistBtn');

    // Guard — modal may not be on every page
    if (!this.overlay) return;

    // Close modal when X button is clicked
    this.closeBtn?.addEventListener('click', () => this.close());

    // Close modal when clicking outside the modal panel
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    // Add to cart button handler
    this.addToCartBtn?.addEventListener('click', () => {
      if (!this.currentProduct) return;
      const comment = this.commentEl?.value || '';
      if (window.Cart) {
        window.Cart.addItem(this.currentProduct, 1, comment);
        this.close();
      }
    });

    // Wishlist toggle in modal
    this.wishlistBtn?.addEventListener('click', () => {
      if (!this.currentProduct) return;
      if (window.Wishlist) {
        window.Wishlist.toggle(this.currentProduct, this.wishlistBtn);
        this.updateWishlistBtn();
      }
    });
  },

  /**
   * Open the modal and populate with product data.
   * @param {object} product - Product data from API or card
   */
  open(product) {
    if (!this.overlay || !product) return;
    this.currentProduct = product;
    window.VavhAnalytics?.track('product_view', product);

    // Populate modal fields with product data
    if (this.imgEl) {
      this.imgEl.src = window.Helpers.productImage(product.image_url);
      this.imgEl.alt = product.name;
    }
    if (this.titleEl) this.titleEl.textContent = product.name;
    if (this.nameEl)  this.nameEl.textContent  = product.name;
    if (this.categoryEl) this.categoryEl.textContent = product.category_name || 'Décor';
    if (this.priceEl) this.priceEl.textContent = window.Helpers.formatPrice(product.price);
    if (this.descEl)  this.descEl.textContent  = product.description || 'A beautifully crafted piece for your home.';

    // Clear comment textarea on open
    if (this.commentEl) this.commentEl.value = '';

    // Update wishlist button state
    this.updateWishlistBtn();

    // Show modal overlay — CSS transition handles animation
    this.overlay.classList.add('open');
    this.overlay.setAttribute('aria-hidden', 'false');

    // Prevent body from scrolling behind modal
    document.body.style.overflow = 'hidden';

    // Focus first focusable element in modal for accessibility
    setTimeout(() => this.closeBtn?.focus(), 100);
  },

  // Close the modal and restore body scroll
  close() {
    if (!this.overlay) return;
    this.overlay.classList.remove('open');
    this.overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    this.currentProduct = null;
  },

  // Update wishlist button icon/text based on current state
  updateWishlistBtn() {
    if (!this.wishlistBtn || !this.currentProduct) return;
    const isWishlisted = window.Storage.isWishlisted(this.currentProduct.id);
    this.wishlistBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg"
        fill="${isWishlisted ? 'currentColor' : 'none'}"
        viewBox="0 0 24 24"
        stroke-width="1.6"
        stroke="currentColor"
        style="width:18px;height:18px;color:${isWishlisted ? 'var(--color-accent)' : 'inherit'};"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
      ${isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
    `;
  },
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => ProductModal.init());

// Expose globally
window.ProductModal = ProductModal;
