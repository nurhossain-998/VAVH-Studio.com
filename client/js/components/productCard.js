/* ============================================================
   js/components/productCard.js — Product Card HTML Builder
   Creates and returns a DOM element for a product card
   ============================================================ */

/**
 *
 * @param {object} product    - Product data object from API
 * @param {number} index      - Position index for stagger animation delay
 * @returns {HTMLElement}     - Fully constructed product card element
 */
function buildProductCard(product, index = 0) {
  // Create outer card article element
  const card = document.createElement('article');
  // Apply card base class and reveal animation class
  card.className = 'product-card reveal';
  // Apply stagger delay based on position (max delay-8)
  if (index < 8) card.classList.add(`delay-${index + 1}`);
  // Store product ID as data attribute for click handling
  card.dataset.productId = product.id;

  // Determine wishlist state from local storage
  const isWishlisted = window.Storage && window.Storage.isWishlisted(product.id);

  // Get resolved image URL — use fallback if none
  const imgSrc = window.Helpers.productImage(product.image_url);
  const escapeHtml = window.Helpers.escapeHtml;
  const productName = escapeHtml(product.name || 'Untitled product');
  const categoryName = escapeHtml(product.category_name || 'Decor');
  const productId = escapeHtml(product.id);

  // Build card inner HTML with all sub-elements
  card.innerHTML = `
    <!-- Image wrapper with fixed aspect ratio -->
    <div class="product-card__img-wrap">
      <!-- Lazy-loaded product image -->
      <img
        src="${escapeHtml(imgSrc)}"
        alt="${productName}"
        class="product-card__img"
        loading="lazy"
      />
      <!-- Gradient overlay at image bottom for legibility -->
      <div class="product-card__img-overlay"></div>

      <!-- Category tag badge on image -->
      <span class="product-card__category">${categoryName}</span>

      <!-- Wishlist heart toggle button -->
      <button
        class="product-card__wishlist ${isWishlisted ? 'active' : ''}"
        aria-label="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}"
        data-product-id="${productId}"
      >
        <svg xmlns="http://www.w3.org/2000/svg"
          fill="${isWishlisted ? 'currentColor' : 'none'}"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      </button>
    </div>

    <!-- Card text info area -->
    <div class="product-card__info">
      <!-- Product title — clamps to 2 lines -->
      <h3 class="product-card__title">${productName}</h3>

      <!-- Price + add-to-cart row -->
      <div class="product-card__price-row">
        <!-- Formatted price -->
        <span class="product-card__price">
          ${window.Helpers.formatPrice(product.price)}
        </span>
        <!-- Quick add-to-cart button — small circle -->
        <button
          class="product-card__add-btn"
          aria-label="Add ${productName} to cart"
          data-product-id="${productId}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>
    </div>
  `;

  card.querySelector('.product-card__img')?.addEventListener('error', (event) => {
    event.currentTarget.src = window.VAVH.DEFAULT_PRODUCT_IMG;
  }, { once: true });

  // ── Event listeners ───────────────────────────────────────

  // Click on card body (not buttons) → open product modal
  card.addEventListener('click', (e) => {
    // Don't open modal if a button inside was clicked
    const target = e.target && typeof e.target.closest === 'function' ? e.target : null;
    if (target?.closest('.product-card__wishlist') || target?.closest('.product-card__add-btn')) return;
    window.VavhAnalytics?.track('product_click', product);
    window.VavhAnalytics?.track('product_view', product);
    // Open product detail modal
    if (window.ProductModal) window.ProductModal.open(product);
  });

  // Wishlist toggle button click
  const wishlistBtn = card.querySelector('.product-card__wishlist');
  if (wishlistBtn) {
    wishlistBtn.addEventListener('click', (e) => {
      // Stop propagation to prevent card click
      e.stopPropagation();
      // Toggle wishlist state
      if (window.Wishlist) {
        window.Wishlist.toggle(product, wishlistBtn);
      }
    });
  }

  // Quick add-to-cart button click
  const addBtn = card.querySelector('.product-card__add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.Cart) {
        window.Cart.addItem(product, 1);
        // Bounce animation feedback on button
        addBtn.style.transform = 'scale(1.3)';
        setTimeout(() => addBtn.style.transform = '', 200);
      }
    });
  }

  return card;
}

/**
 * Render an array of products into a container element.
 * Clears existing content first.
 *
 * @param {HTMLElement} container  - Grid element to render into
 * @param {Array}       products   - Array of product objects
 */
function renderProductGrid(container, products) {
  if (!container) return;

  // Clear existing skeleton or previous cards
  container.innerHTML = '';

  if (!products || products.length === 0) {
    // Show empty state if no products
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
        <h3>No products found</h3>
        <p>Try a different search or category filter.</p>
      </div>
    `;
    return;
  }

  // Build and append each product card
  products.forEach((product, index) => {
    const card = buildProductCard(product, index);
    container.appendChild(card);
  });

  // Trigger scroll reveal for newly added cards
  if (window.ScrollReveal) window.ScrollReveal.refresh();
}

// Expose globally
window.buildProductCard = buildProductCard;
window.renderProductGrid = renderProductGrid;
