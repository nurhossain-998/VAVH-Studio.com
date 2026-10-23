/* ============================================================
   js/animations/scrollReveal.js — Intersection Observer Reveal
   Adds .revealed class when .reveal elements enter viewport
   ============================================================ */

const ScrollReveal = {
  // IntersectionObserver instance
  observer: null,

  init() {
    // Create observer that triggers when element is 10% visible
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Add revealed class — CSS handles the transition
            entry.target.classList.add('revealed');
            // Stop observing after reveal (one-shot animation)
            this.observer.unobserve(entry.target);
          }
        });
      },
      {
        // Trigger when 10% of element is visible
        threshold: 0.1,
        // Start animating slightly before element enters viewport
        rootMargin: '0px 0px -40px 0px',
      }
    );

    // Observe all existing reveal elements
    this.observeAll();
  },

  // Observe all .reveal elements currently in DOM
  observeAll() {
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
      this.observer?.observe(el);
    });
  },

  // Re-scan DOM for newly added reveal elements (called after grid renders)
  refresh() {
    this.observeAll();
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => ScrollReveal.init());

// Expose globally so productCard.js can call ScrollReveal.refresh()
window.ScrollReveal = ScrollReveal;
