/* ============================================================
   js/utils/api.js — Fetch Wrapper with JWT Auth for VAVH.Studio
   All HTTP requests go through this module
   ============================================================ */

/**
 * Core API request function.
 * Automatically attaches Authorization header if token exists.
 *
 * @param {string} endpoint   - API path e.g. '/products'
 * @param {object} options    - Fetch options (method, body, etc.)
 * @returns {Promise<any>}    - Parsed JSON response
 */
async function ensureCsrfToken() {
  if (sessionStorage.getItem('vavh_csrf_token')) return;

  try {
    const response = await fetch(`${window.VAVH.API_BASE_URL}/csrf-token`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (response.ok && data.success && data.csrfToken) {
      sessionStorage.setItem('vavh_csrf_token', data.csrfToken);
    }
  } catch (err) {
    console.warn('[CSRF] Unable to fetch token:', err);
  }
}

async function apiRequest(endpoint, options = {}) {
  // Resolve admin paths to the admin API mount when the storefront base is active
  const url = typeof window.resolveApiPath === 'function'
    ? window.resolveApiPath(endpoint, window.VAVH.API_BASE_URL)
    : `${window.VAVH.API_BASE_URL}${endpoint}`;
  const isAdminRequest = url.startsWith('/api/admin/');
  // Admin endpoints authenticate with the server session. Storefront endpoints
  // continue to use the JWT flow for customer authentication.
  const token = isAdminRequest ? null : localStorage.getItem(window.VAVH.TOKEN_KEY);

  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    await ensureCsrfToken();
  }
  const csrfToken = sessionStorage.getItem('vavh_csrf_token');

  // Merge default headers with any provided options
  const config = {
    credentials: 'include',
    headers: {
      // Always expect JSON responses
      'Content-Type': 'application/json',
      // Include Bearer token if user is authenticated
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method) ? { 'X-CSRF-Token': csrfToken } : {}),
      // Spread any additional headers from caller
      ...(options.headers || {}),
    },
    // Spread remaining options (method, body, etc.)
    ...options,
  };

  console.log(`[apiRequest] ${options.method || 'GET'} ${url}`, { hasToken: !!token });

  // Perform the fetch request
  const response = await fetch(url, config);

  // Parse JSON body regardless of status code
  const data = await response.json();

  console.log(`[apiRequest] Response status: ${response.status}`, data);

  // If response is not 2xx, throw error with server message
  if (!response.ok) {
    const error = new Error(data.message || `HTTP error ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  // Return parsed JSON data on success
  return data;
}

/* ── Convenience method wrappers ─────────────────────────── */

// GET request — fetches data from endpoint
const apiGet = (endpoint) =>
  apiRequest(endpoint, { method: 'GET' });

// POST request — sends JSON body to endpoint
const apiPost = (endpoint, body) =>
  apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });

// PUT request — updates a resource
const apiPut = (endpoint, body) =>
  apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

// DELETE request — removes a resource
const apiDelete = (endpoint) => {
  console.log(`[API] DELETE request to: ${endpoint}`);
  return apiRequest(endpoint, { method: 'DELETE' });
};

// PATCH request — partial update
const apiPatch = (endpoint, body) =>
  apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

/* ── Multipart upload (for product images) ───────────────── */

/**
 * Upload a file using multipart/form-data.
 * Does NOT set Content-Type — browser sets it with boundary.
 * 
 * @param {string} endpoint - API endpoint path (e.g., '/upload/product')
 * @param {FormData} formData - FormData object with file attached
 * @returns {Promise<any>} - Response with image_url
 */
async function apiUpload(endpoint, formData) {
  // Get token for auth header
  const token = localStorage.getItem(window.VAVH.TOKEN_KEY);
  const url = `${window.VAVH.API_BASE_URL}${endpoint}`;

  console.log(`[apiUpload] Starting upload to ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    // Let browser set Content-Type automatically for FormData
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await response.json();

  console.log(`[apiUpload] Response status: ${response.status}`, data);

  if (!response.ok) {
    const errorMsg = data.message || `Upload failed (HTTP ${response.status})`;
    console.error(`[apiUpload] Upload error:`, errorMsg);
    throw new Error(errorMsg);
  }

  if (!data.image_url) {
    console.error(`[apiUpload] No image_url in response:`, data);
    throw new Error('No image URL returned from server');
  }

  console.log(`[apiUpload] Upload successful. URL: ${data.image_url}`);
  return data;
}

/**
 * Verify that an uploaded image exists on the server
 * 
 * @param {string} filename - The filename to verify
 * @returns {Promise<boolean>} - True if file exists
 */
async function apiVerifyUpload(filename) {
  try {
    const response = await apiGet(`/upload/verify/${filename}`);
    return response.exists === true;
  } catch (err) {
    console.error(`[apiVerifyUpload] Error verifying ${filename}:`, err);
    return false;
  }
}

// Expose API functions globally
window.api = {
  get:    apiGet,
  post:   apiPost,
  put:    apiPut,
  patch:  apiPatch,
  delete: apiDelete,
  upload: apiUpload,
  verifyUpload: apiVerifyUpload,
};
