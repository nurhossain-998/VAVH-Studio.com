/* ============================================================
   js/components/toast.js — Toast Notification Manager
   Show success, error, and info toasts with auto-dismiss
   ============================================================ */

const Toast = {
  // Reference to the toast container element
  container: null,

  // Initialize — find or create the container element
  init() {
    // Use existing container in DOM if present
    this.container = document.getElementById('toastContainer');
    if (!this.container) {
      // Create container if not in HTML
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.id = 'toastContainer';
      this.container.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.container);
    }
  },

  /**
   * Show a toast notification.
   * @param {string} message    - Text to display
   * @param {'success'|'error'|'info'} type - Visual variant
   * @param {number} duration   - Auto-dismiss delay in ms (0 = no auto-dismiss)
   */
  show(message, type = 'info', duration = 3500) {
    // Ensure container is ready
    if (!this.container) this.init();

    // Create toast element
    const toast = document.createElement('div');
    // Apply base toast class + type variant
    toast.className = `toast toast-${type === 'success' ? 'success' : type === 'error' ? 'error' : 'accent'}`;
    toast.setAttribute('role', 'status');

    // Choose icon SVG based on type
    const iconSVGs = {
      success: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
      error:   '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>',
      info:    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>',
    };

    // Keep trusted icon markup separate from untrusted message text.
    const icon = document.createElement('span');
    icon.style.flexShrink = '0';
    icon.innerHTML = iconSVGs[type] || iconSVGs.info;
    const messageEl = document.createElement('span');
    messageEl.textContent = String(message ?? '');
    toast.append(icon, messageEl);

    // Append to container — CSS animates it in
    this.container.appendChild(toast);

    // Auto-remove after duration if not 0
    if (duration > 0) {
      setTimeout(() => this.dismiss(toast), duration);
    }

    // Allow click to dismiss early
    toast.addEventListener('click', () => this.dismiss(toast));

    return toast;
  },

  // Animate out and remove a toast element
  dismiss(toastEl) {
    if (!toastEl || !toastEl.parentNode) return;
    // Fade out by reducing opacity
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateX(40px)';
    toastEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    // Remove from DOM after transition
    setTimeout(() => toastEl.remove(), 260);
  },

  // Convenience: success toast
  success(message, duration) {
    return this.show(message, 'success', duration);
  },

  // Convenience: error toast
  error(message, duration) {
    return this.show(message, 'error', duration);
  },

  // Convenience: info/default toast
  info(message, duration) {
    return this.show(message, 'info', duration);
  },
};

// Initialise toast on DOM ready
document.addEventListener('DOMContentLoaded', () => Toast.init());

// Expose globally
window.Toast = Toast;
