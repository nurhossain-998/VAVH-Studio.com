/* Lightweight anonymous website analytics collector for VAVH AI. */
const VavhAnalytics = {
  sessionKey: 'vavh_analytics_session',

  sessionId() {
    let id = localStorage.getItem(this.sessionKey);
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(this.sessionKey, id);
    }
    return id;
  },

  track(eventType, product = null) {
    if (!window.api?.post) return Promise.resolve();
    return window.api.post('/analytics/event', {
      sessionId: this.sessionId(),
      eventType,
      productId: product?.id || null,
      categoryId: product?.category_id || null,
      source: 'website',
    }).catch(() => undefined);
  },

  start() {
    this.track('session');
  },
};

window.VavhAnalytics = VavhAnalytics;
document.addEventListener('DOMContentLoaded', () => VavhAnalytics.start());
