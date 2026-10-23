/* ============================================================
   js/animations/heroParallax.js — Subtle Hero Parallax Effect
   Moves hero background layer based on scroll position
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Find the hero section — only exists on homepage
  const hero = document.querySelector('.hero');
  if (!hero) return;

  // Attach parallax on scroll — very subtle movement
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    // Move hero background pseudo elements at 0.3× scroll speed
    hero.style.setProperty('--parallax-y', `${scrollY * 0.3}px`);
  }, { passive: true });
});


/* ============================================================
   js/animations/cardHover.js — Product Card Micro-Interactions
   Additional JS-driven hover effects beyond pure CSS
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Delegate event for dynamically added product cards
  document.addEventListener('mouseenter', (e) => {
    const target = e.target && typeof e.target.closest === 'function' ? e.target : null;
    const card = target?.closest('.product-card');
    if (!card) return;
    // Subtle scale on image — already handled by CSS but add shadow
    card.style.setProperty('--card-shadow', 'var(--shadow-lg)');
  }, true);

  document.addEventListener('mouseleave', (e) => {
    const target = e.target && typeof e.target.closest === 'function' ? e.target : null;
    const card = target?.closest('.product-card');
    if (!card) return;
    card.style.removeProperty('--card-shadow');
  }, true);
});
