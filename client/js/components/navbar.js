/* ============================================================
   js/components/navbar.js — Navbar Behavior for VAVH.Studio
   Handles: scroll shadow, hamburger, auth state, badges
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Element references ─────────────────────────────────────

  // Main navbar element
  const navbar       = document.getElementById('mainNavbar');
  // Hamburger toggle button (mobile)
  const hamburger    = document.getElementById('navHamburger');
  // Mobile dropdown menu panel
  const mobileMenu   = document.getElementById('navMobileMenu');
  // Login / Account button in navbar
  const loginBtn     = document.getElementById('navLoginBtn');
  // Cart icon button that opens the cart drawer
  const cartBtn      = document.getElementById('cartNavBtn');
  // Wishlist icon button
  const wishlistBtn  = document.getElementById('wishlistNavBtn');
  // Cart badge counter element
  const cartBadge    = document.getElementById('cartBadge');
  // Wishlist badge counter element
  const wishlistBadge = document.getElementById('wishlistBadge');

  // ── Scroll shadow ─────────────────────────────────────────

  // Add/remove .scrolled class on navbar based on scroll position
  function updateNavbarScroll() {
    if (!navbar) return;
    if (window.scrollY > 10) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  // Listen for scroll events to trigger shadow update
  window.addEventListener('scroll', updateNavbarScroll, { passive: true });
  // Run once on load in case page starts scrolled
  updateNavbarScroll();

  // ── Hamburger / Mobile Menu ────────────────────────────────

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      // Toggle open class to show/hide mobile menu
      const isOpen = mobileMenu.classList.toggle('open');
      // Update ARIA attribute for accessibility
      hamburger.setAttribute('aria-expanded', isOpen.toString());
      mobileMenu.setAttribute('aria-hidden', (!isOpen).toString());
    });

    // Close mobile menu when clicking outside of it
    document.addEventListener('click', (e) => {
      if (
        mobileMenu.classList.contains('open') &&
        !mobileMenu.contains(e.target) &&
        !hamburger.contains(e.target)
      ) {
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        mobileMenu.setAttribute('aria-hidden', 'true');
      }
    });

    // Close mobile menu on Escape key press
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ── Auth state — update login button ──────────────────────

  function updateAuthUI() {
    if (!loginBtn) return;
    const user = window.Storage && window.Storage.getUser();

    if (user) {
      // User is logged in — show initials and link to dashboard
      const initials = window.Helpers.getInitials(user.name);
      loginBtn.href = 'dashboard.html';
      loginBtn.innerHTML = `
        <span style="width:28px;height:28px;background:linear-gradient(135deg,var(--color-sage),var(--color-blush));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:var(--text-xs);font-weight:700;color:white;flex-shrink:0;">${initials}</span>
        <span class="btn-text">${user.name.split(' ')[0]}</span>
      `;
    } else {
      // Not logged in — show default Account button
      loginBtn.href = 'login.html';
      loginBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
        <span class="btn-text">Account</span>
      `;
    }
  }

  // ── Badge counters ─────────────────────────────────────────

  // Update cart badge with current item count
  function updateCartBadge() {
    if (!cartBadge || !window.Storage) return;
    const count = window.Storage.getCartCount();
    if (count > 0) {
      cartBadge.textContent = count > 99 ? '99+' : count;
      cartBadge.classList.remove('hidden');
    } else {
      cartBadge.classList.add('hidden');
    }
  }

  // Update wishlist badge with current item count
  function updateWishlistBadge() {
    if (!wishlistBadge || !window.Storage) return;
    const count = window.Storage.getWishlist().length;
    if (count > 0) {
      wishlistBadge.textContent = count > 99 ? '99+' : count;
      wishlistBadge.classList.remove('hidden');
    } else {
      wishlistBadge.classList.add('hidden');
    }
  }

  // ── Cart drawer toggle ─────────────────────────────────────

  if (cartBtn) {
    cartBtn.addEventListener('click', () => {
      // Open cart drawer — Cart component handles render
      if (window.Cart) window.Cart.open();
    });
  }

  // ── Wishlist page link ─────────────────────────────────────

  if (wishlistBtn) {
    wishlistBtn.addEventListener('click', () => {
      // Navigate to dashboard wishlist tab if logged in
      if (window.Storage.isLoggedIn()) {
        window.location.href = 'dashboard.html#wishlist';
      } else {
        window.location.href = 'login.html';
      }
    });
  }

  // ── Custom events for badge refresh ───────────────────────

  // Listen for cart updates (fired by cart.js)
  document.addEventListener('cartUpdated', updateCartBadge);

  // Listen for wishlist updates (fired by wishlist.js)
  document.addEventListener('wishlistUpdated', updateWishlistBadge);

  // Run initial UI updates
  updateAuthUI();
  updateCartBadge();
  updateWishlistBadge();

  // Expose update functions so other modules can call them
  window.NavbarUI = { updateAuthUI, updateCartBadge, updateWishlistBadge };
});
