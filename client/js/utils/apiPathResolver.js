function resolveApiPath(endpoint, baseUrl = window?.VAVH?.API_BASE_URL || '') {
  if (!endpoint || typeof endpoint !== 'string') return endpoint;
  if (/^https?:\/\//i.test(endpoint)) return endpoint;

  const normalizedBase = (baseUrl || '').replace(/\/$/, '');
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (normalizedEndpoint.startsWith('/admin/')) {
    return `/api/admin${normalizedEndpoint.replace(/^\/admin/, '')}`;
  }

  if (normalizedEndpoint.startsWith('/storefront/')) {
    return `${normalizedBase}${normalizedEndpoint}`;
  }

  if (normalizedBase === '/api/storefront') {
    return `/api/storefront${normalizedEndpoint}`;
  }

  return `${normalizedBase}${normalizedEndpoint}`;
}

if (typeof module !== 'undefined') {
  module.exports = { resolveApiPath };
}

if (typeof window !== 'undefined') {
  window.resolveApiPath = resolveApiPath;
}
