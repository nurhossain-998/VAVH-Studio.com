/* ============================================================
   js/pages/home.js — Homepage Logic for VAVH.Studio
   Fetches and renders featured products with category filter
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {

  // Container for the featured products grid on homepage
  const grid       = document.getElementById('featuredGrid');
  // Filter pill wrapper on homepage
  const filterWrap = document.getElementById('homeFilterWrap');
  const categoryStrip = document.getElementById('categoryStrip');

  // Keep the desktop cards and mobile navigation tied to the shared category list.
  function renderCategoryCards() {
    if (!categoryStrip) return;

    const categoryIcons = {
      'Planter': '<path d="M5 9h14l-1.2 11H6.2L5 9Z"/><path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5Z"/><path d="M12 9c0-3-2-5-5-5 0 3 2 5 5 5Z"/><path d="M12 9v3"/>',
      '3D Planter': '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/>',
      'LED Mirror': '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 7v.01"/><path d="M9 17h6"/>',
      'Furniture': '<path d="M6 11V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6"/><path d="M4 11h16v6H4z"/><path d="M6 17v4m12-4v4"/>',
      'Home Decor': '<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/>',
    };

    categoryStrip.innerHTML = (window.VAVH.CATEGORIES || [])
      .filter(categoryName => categoryName !== 'All')
      .map(categoryName => {
        const icon = categoryIcons[categoryName] || '<circle cx="12" cy="12" r="8"/>';
        const label = categoryName === 'Home Decor' ? 'Home Décor' : categoryName;
        const query = new URLSearchParams({ cat: categoryName });
        return `
          <a href="products.html?${query}" class="category-card" aria-label="Shop ${label}">
            <span class="category-card__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
            </span>
            <span class="category-card__name">${label}</span>
          </a>
        `;
      })
      .join('');
  }

  renderCategoryCards();

  // Store full product list for client-side filtering
  let allProducts = [];

  // ── Fetch products from API ────────────────────────────────

  async function loadProducts() {
    try {
      // Request featured/all products from API
      const data = await window.api.get('/products?featured=true&limit=8');
      allProducts = data.products || data;
      // Render initial full list
      renderFiltered('all');
      // Start hero animation
      startHeroAnimation(allProducts);
    } catch (err) {
      // Show error state in grid
      if (grid) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
            <h3>Could not load products</h3>
            <p>Please check your connection and refresh.</p>
          </div>
        `;
      }
    }
  }

  // ── Filter and render products by category ─────────────────

  function renderFiltered(category) {
    const filtered = category === 'all'
      ? allProducts
      : allProducts.filter(p =>
          p.category_name?.toLowerCase() === category.toLowerCase()
        );
    window.renderProductGrid(grid, filtered);
  }

  // ── Attach filter pill click handlers ──────────────────────

  if (filterWrap) {
    filterWrap.addEventListener('click', (e) => {
      const target = e.target && typeof e.target.closest === 'function' ? e.target : null;
      const pill = target?.closest('.filter-pill');
      if (!pill) return;
      // Deactivate all, activate clicked
      filterWrap.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      // Re-render with selected category
      renderFiltered(pill.dataset.cat);
    });
  }

  // ── Load products ──────────────────────────────────────────
  await loadProducts();

  // ── Hero 3D Coverflow & Cinematic Showcase Controller ──────
  function startHeroAnimation(products) {
    const coverflowTrack = document.getElementById('heroCoverflow');
    const dotsTrack = document.getElementById('coverflowDots');
    if (!coverflowTrack) return;

    // Clear loading skeleton
    coverflowTrack.innerHTML = '';
    if (dotsTrack) dotsTrack.innerHTML = '';

    // Filter products that actually have valid images
    const validProducts = products.filter(p => p.image_url && p.image_url.trim() !== '');
    if (validProducts.length === 0) {
      showFallbackState();
      return;
    }

    // Limit showcase to maximum of 8 elements for pure luxury feel
    const showcaseProducts = validProducts.slice(0, 8);
    let currentIndex = 0;
    const slides = [];
    const dots = [];

    // 1. Dynamically build Coverflow slides & pagination dots
    showcaseProducts.forEach((product, idx) => {
      const imageUrl = window.Helpers.productImage(product.image_url);

      // Create slide card
      const slide = document.createElement('div');
      slide.className = 'hero__coverflow-slide';
      slide.dataset.slideIndex = idx;
      slide.innerHTML = `
        <img class="hero__coverflow-img" src="${imageUrl}" alt="${product.name}" onerror="this.src='${window.VAVH.DEFAULT_PRODUCT_IMG}'" />
        <div class="hero__coverflow-card-info">
          <span class="hero__coverflow-card-cat">${product.category_name || 'Artisan Piece'}</span>
          <h3 class="hero__coverflow-card-title">${product.name}</h3>
        </div>
      `;
      coverflowTrack.appendChild(slide);
      slides.push(slide);

      // Create dot
      if (dotsTrack) {
        const dot = document.createElement('div');
        dot.className = 'hero__coverflow-dot';
        dot.dataset.dotIndex = idx;
        dotsTrack.appendChild(dot);
        dots.push(dot);
      }
    });

    // 2. Main controller logic to update 3D positions and Dynamic text
    function updateCoverflow() {
      if (slides.length === 0) return;

      slides.forEach((slide, idx) => {
        slide.className = 'hero__coverflow-slide'; // reset

        let diff = idx - currentIndex;

        // Infinite loop wrap-around calculations
        if (diff < -Math.floor(slides.length / 2)) {
          diff += slides.length;
        } else if (diff > Math.floor(slides.length / 2)) {
          diff -= slides.length;
        }

        // Apply 3D classes
        if (diff === 0) {
          slide.classList.add('active');
        } else if (diff === -1) {
          slide.classList.add('prev');
        } else if (diff === 1) {
          slide.classList.add('next');
        } else if (diff < -1) {
          slide.classList.add('hidden-left');
        } else if (diff > 1) {
          slide.classList.add('hidden-right');
        }
      });

      // Update Pagination Dots
      dots.forEach((dot, idx) => {
        if (idx === currentIndex) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });

      // Sync Dynamic Cinematic Showcase Panel (Left Text Column)
      const activeProduct = showcaseProducts[currentIndex];
      updateCinematicShowcase(activeProduct);

      // Sync Dynamic Ambient Glow Color Shifting
      updateAmbientGlow(activeProduct);
    }

    // 3. Cinematic left text column updating with smooth CSS animation transition
    function updateCinematicShowcase(product) {
      const textContainer = document.getElementById('heroTextContainer');
      if (!textContainer) return;

      // Soft transition fade-out/slide-up
      textContainer.style.transition = 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
      textContainer.style.opacity = '0';
      textContainer.style.transform = 'translateY(-8px)';

      setTimeout(() => {
        // Swap content
        textContainer.innerHTML = `
          <div class="hero__showcase-panel">
            <div class="hero__showcase-header">
              <span class="hero__showcase-badge">${product.category_name || 'FEATURED COLLECTION'}</span>
            </div>
            <h2 class="hero__showcase-title">${product.name}</h2>
            <span class="hero__showcase-price">${window.Helpers.formatPrice(product.price)}</span>
            <p class="hero__showcase-desc">
              ${product.description || 'Artisanal organic craftsmanship carefully curated to inspire a sense of organic tranquility and timeless presence.'}
            </p>
          </div>
          <div class="hero__actions">
            <a href="products.html?id=${product.id}" class="btn btn-primary btn-lg">Browse product</a>
            <a href="services.html" class="btn btn-ghost btn-lg">Our Services</a>
          </div>
        `;

        // Fade in
        textContainer.style.opacity = '1';
        textContainer.style.transform = 'translateY(0)';
      }, 350);
    }

    // 4. Color shift the dynamic backdrop ambient glow based on active product category
    function updateAmbientGlow(product) {
      const glow = document.getElementById('coverflowAmbient');
      if (!glow) return;

      const category = (product.category_name || '').toLowerCase();
      let glowColor = 'rgba(212, 149, 106, 0.25)'; // default amber warm glow

      if (category.includes('mirror') || category.includes('glass')) {
        glowColor = 'rgba(232, 196, 184, 0.35)'; // warm blush
      } else if (category.includes('plant') || category.includes('vase') || category.includes('pot') || category.includes('decor')) {
        glowColor = 'rgba(168, 181, 160, 0.35)'; // natural sage green
      } else if (category.includes('furniture') || category.includes('chair') || category.includes('table')) {
        glowColor = 'rgba(197, 160, 126, 0.3)'; // earthy walnut amber
      }

      glow.style.background = `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`;
    }

    // 5. Fallback state logic if API products loading fails
    function showFallbackState() {
      const container = document.getElementById('heroTextContainer');
      if (container) {
        container.innerHTML = `
          <p class="hero__subtitle animate-fade-up delay-3" id="heroSubtitle">
            Curated planters, statement mirrors and artisan furniture crafted for modern, mindful homes.
          </p>
          <div class="hero__actions animate-fade-up delay-4" id="heroActions">
            <a href="products.html" class="btn btn-primary btn-lg">Explore Collection</a>
            <a href="services.html" class="btn btn-ghost btn-lg">Our Services</a>
          </div>
        `;
      }
      if (coverflowTrack) {
        coverflowTrack.innerHTML = `
          <div class="empty-state">
            <p>Failed to load pieces. Explore the collections below.</p>
          </div>
        `;
      }
    }

    // 6. Navigation Functions
    function navigateNext() {
      currentIndex = (currentIndex + 1) % slides.length;
      updateCoverflow();
    }

    function navigatePrev() {
      currentIndex = (currentIndex - 1 + slides.length) % slides.length;
      updateCoverflow();
    }

    // 7. Interactive Event Listeners
    const nextBtn = document.getElementById('coverflowNext');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        navigateNext();
        resetAutoRotation();
      });
    }

    const prevBtn = document.getElementById('coverflowPrev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        navigatePrev();
        resetAutoRotation();
      });
    }

    // Direct card click interaction
    slides.forEach((slide, idx) => {
      slide.addEventListener('click', () => {
        if (currentIndex !== idx) {
          currentIndex = idx;
          updateCoverflow();
          resetAutoRotation();
        } else {
          // Double click or active click redirects to catalog details
          window.location.href = `products.html?id=${showcaseProducts[currentIndex].id}`;
        }
      });
    });

    // Pagination dot click interaction
    dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        if (currentIndex !== idx) {
          currentIndex = idx;
          updateCoverflow();
          resetAutoRotation();
        }
      });
    });

    // Arrow keys keyboard accessibility
    document.addEventListener('keydown', (e) => {
      const rect = coverflowTrack.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inView) return;

      if (e.key === 'ArrowRight') {
        navigateNext();
        resetAutoRotation();
      } else if (e.key === 'ArrowLeft') {
        navigatePrev();
        resetAutoRotation();
      }
    });

    // 8. Auto Rotation handling
    let autoRotateInterval = setInterval(navigateNext, 4000);

    function resetAutoRotation() {
      clearInterval(autoRotateInterval);
      autoRotateInterval = setInterval(navigateNext, 4000);
    }

    // Initialize layout
    updateCoverflow();
  }
});
