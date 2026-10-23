/* ============================================================
   js/utils/constants.js — App-wide constants for VAVH.Studio
   Change API_BASE_URL to match your server deployment
   ============================================================ */

// Base URL for all API requests — update this for production
const API_BASE_URL = 'http://localhost:3000/api/storefront';

// JWT token key stored in localStorage
const TOKEN_KEY = 'vavh_token';

// User data key stored in localStorage
const USER_KEY = 'vavh_user';

// Cart key stored in localStorage (for guest cart sync)
const CART_KEY = 'vavh_cart';

// Wishlist key stored in localStorage
const WISHLIST_KEY = 'vavh_wishlist';

// Currency symbol used across the site
const CURRENCY = '৳';

// Default product image placeholder (data URI fallback)
const DEFAULT_PRODUCT_IMG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUwMCIgZmlsbD0iI0YwRUJFMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjN0E3MjZCIiBmb250LXNpemU9IjE0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';

// Product categories list
const CATEGORIES = ['All', 'Planter', '3D Planter', 'LED Mirror', 'Furniture', 'Home Decor'];

// Order status display map
const ORDER_STATUS = {
  pending:    { label: 'Pending',    class: 'badge-pending'    },
  processing: { label: 'Processing', class: 'badge-processing' },
  shipped:    { label: 'Shipped',    class: 'badge-processing' },
  delivered:  { label: 'Delivered',  class: 'badge-delivered'  },
  cancelled:  { label: 'Cancelled',  class: 'badge-cancelled'  },
};

// Expose constants globally so all scripts can access them
window.VAVH = {
  API_BASE_URL,
  TOKEN_KEY,
  USER_KEY,
  CART_KEY,
  WISHLIST_KEY,
  CURRENCY,
  DEFAULT_PRODUCT_IMG,
  CATEGORIES,
  ORDER_STATUS,
};
