/* ============================================================
   js/utils/helpers.js — General Utility Functions for VAVH.Studio
   Formatting, DOM helpers, debounce, validation
   ============================================================ */

const Helpers = {

  /* ── Formatting ─────────────────────────────────────────── */

  // Format number as Bangladeshi Taka currency string
  formatPrice(amount) {
    // Ensure amount is a number; fallback to 0
    const num = Number(amount) || 0;
    // Format with comma separators and no decimal for whole amounts
    return `${window.VAVH.CURRENCY}${num.toLocaleString('en-BD')}`;
  },

  // Format a date string to readable local format
  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-BD', {
      year:  'numeric',
      month: 'short',
      day:   'numeric',
    });
  },

  // Truncate text to maxLength with ellipsis
  truncate(text, maxLength = 80) {
    if (!text) return '';
    return text.length > maxLength
      ? `${text.slice(0, maxLength)}…`
      : text;
  },

  // Escape untrusted text before placing it in an HTML template.
  escapeHtml(value = '') {
    const element = document.createElement('div');
    element.textContent = String(value ?? '');
    return element.innerHTML;
  },

  // Extract user initials from full name (e.g. "Jane Doe" → "JD")
  getInitials(name = '') {
    return name
      .split(' ')
      .slice(0, 2)
      // Take first character of each word and uppercase it
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  },

  /* ── DOM Helpers ─────────────────────────────────────────── */

  // Get element by ID — shorthand
  id(elementId) {
    return document.getElementById(elementId);
  },

  // Get first element matching selector
  qs(selector, parent = document) {
    return parent.querySelector(selector);
  },

  // Get all elements matching selector as array
  qsa(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  },

  // Show a DOM element (removes 'hidden' class, sets display)
  show(element) {
    if (!element) return;
    element.classList.remove('hidden');
    if (element.style.display === 'none') {
      element.style.display = '';
    }
  },

  // Hide a DOM element (adds 'hidden' class)
  hide(element) {
    if (!element) return;
    element.classList.add('hidden');
  },

  // Toggle element visibility
  toggle(element) {
    if (!element) return;
    element.classList.toggle('hidden');
  },

  /* ── URL Params ──────────────────────────────────────────── */

  // Get value of a URL query parameter by name
  getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  // Build a query string from an object of key-value pairs
  buildQuery(params) {
    return '?' + new URLSearchParams(params).toString();
  },

  /* ── Debounce ─────────────────────────────────────────────── */

  // Return a debounced version of a function
  // fn will only execute after 'delay' ms of inactivity
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  /* ── Validation ──────────────────────────────────────────── */

  // Validate email address format
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  // Validate phone number (basic format check)
  isValidPhone(phone) {
    // Accepts +880 or 01 prefixed numbers
    return /^(\+?880|0)1[3-9]\d{8}$/.test(phone.replace(/\s/g, ''));
  },

  // Validate password strength (minimum 8 characters)
  isValidPassword(password) {
    return password && password.length >= 8;
  },

  /* ── Image Handling ──────────────────────────────────────── */

  // Return product image URL or fallback placeholder
  productImage(url) {
    if (!url || url.trim() === '') {
      return window.VAVH.DEFAULT_PRODUCT_IMG;
    }
    
    const trimmedUrl = url.trim();
    if (/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(trimmedUrl)) {
      return trimmedUrl;
    }

    try {
      const parsedUrl = new URL(trimmedUrl, window.location.origin);
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        return parsedUrl.href;
      }
    }
    catch {
      // Fall through to the safe placeholder for malformed URLs.
    }

    return window.VAVH.DEFAULT_PRODUCT_IMG;
  },

  /* ── Scroll ──────────────────────────────────────────────── */

  // Smoothly scroll to top of page
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // Smoothly scroll to an element
  scrollTo(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
};

// Expose helpers globally
window.Helpers = Helpers;
