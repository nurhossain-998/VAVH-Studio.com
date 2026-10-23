/* ============================================================
   js/pages/products.js — Products Page Logic for VAVH.Studio
   Handles: API fetch, search, filter, pagination
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {

  // DOM elements
  const grid         = document.getElementById('productsGrid');
  const filterWrap   = document.getElementById('productFilterWrap');
  const searchInput  = document.getElementById('productSearch');
  const countEl      = document.getElementById('productsCount');
  const loadMoreBtn  = document.getElementById('loadMoreBtn');

  // State
  let allProducts  = [];
  let filtered     = [];
  let activeCategory = 'all';
  let searchQuery  = '';
  let page         = 1;
  const PAGE_SIZE  = 12;

  // ── Load categories for filter pills ──────────────────────

  async function loadCategories() {
    try {
      const cats = await window.api.get('/categories');
      // Build filter pills from API category list
      if (filterWrap) {
        let html = `<button class="filter-pill active" data-cat="all">All</button>`;
        cats.forEach(cat => {
          const categoryName = window.Helpers.escapeHtml(cat.name || '');
          html += `<button class="filter-pill" data-cat="${categoryName}">${categoryName}</button>`;
        });
        filterWrap.innerHTML = html;

        // Re-attach click handlers after rebuilding pills
        filterWrap.onclick = (e) => {
          const target = e.target && typeof e.target.closest === 'function' ? e.target : null;
          const pill = target?.closest('.filter-pill');
          if (!pill) return;
          filterWrap.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          activeCategory = pill.dataset.cat;
          page = 1;
          applyFilters();
        };
      }
    } catch {
      // Keep default "All" pill if categories fail to load
    }
  }

  // ── Load products from API ─────────────────────────────────

  async function loadProducts() {
    try {
      const data = await window.api.get('/products');
      allProducts = data.products || data;
      applyFilters();
    } catch {
      if (grid) grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <h3>Failed to load products</h3>
          <p>Please refresh the page.</p>
        </div>`;
    }
  }

  // ── Apply search + category filters ───────────────────────

  function applyFilters() {
    filtered = allProducts.filter(p => {
      // Category filter
      const catMatch = activeCategory === 'all' ||
        p.category_name?.toLowerCase() === activeCategory.toLowerCase();

      // Search filter — check name and description
      const q = searchQuery.toLowerCase();
      const searchMatch = !q ||
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category_name?.toLowerCase().includes(q);

      return catMatch && searchMatch;
    });

    // Update product count display
    if (countEl) {
      countEl.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
    }

    // Reset to first page when filters change
    renderPage();
  }

  // ── Render current page of filtered products ──────────────

  function renderPage() {
    const start = 0;
    const end   = page * PAGE_SIZE;
    const slice = filtered.slice(start, end);

    window.renderProductGrid(grid, slice);

    // Show/hide load more button
    if (loadMoreBtn) {
      if (end < filtered.length) {
        loadMoreBtn.classList.remove('hidden');
      } else {
        loadMoreBtn.classList.add('hidden');
      }
    }
  }

  // ── Load more pagination ───────────────────────────────────

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      page++;
      renderPage();
    });
  }

  // ── Search input with debounce ─────────────────────────────

  if (searchInput) {
    const debouncedSearch = window.Helpers.debounce((e) => {
      searchQuery = e.target.value.trim();
      page = 1;
      applyFilters();
    }, 300);
    searchInput.addEventListener('input', debouncedSearch);
  }

  // ── Apply URL category param ───────────────────────────────

  // Allow linking directly to a filtered category: products.html?cat=Planter
  const urlCat = window.Helpers.getParam('cat');
  if (urlCat) {
    activeCategory = urlCat;
  }

  // ── Initialize ────────────────────────────────────────────

  await loadCategories();
  await loadProducts();

  // Highlight correct filter pill if URL param was set
  if (urlCat && filterWrap) {
    filterWrap.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.cat === urlCat);
    });
  }

  // Initialize the image manager panel (admin-only tool)
  initImageManager();
});

/* ============================================================
   IMAGE MANAGER — Admin-only tool on the products page
   Lets developers manage product images directly from code:
     1. Upload an image file → get back its served URL
     2. Assign any image URL to a product by ID

   The Admin Panel's existing image upload is NOT touched.
   This is an additive, isolated feature on products.html only.
   ============================================================ */

function initImageManager() {
  // Only show the panel if a valid admin token is present
  // Reads the stored user object to check role
  if (!rawUser) return; // not logged in — panel stays hidden

  let user;
  try { user = JSON.parse(rawUser); } catch { return; }
  const role = user?.role?.toLowerCase();
  if (role !== 'admin' && role !== 'super admin') return; // not admin — panel stays hidden

  // Admin confirmed — reveal the image manager wrapper
  const wrap = document.getElementById('imageManagerWrap');
  if (wrap) wrap.style.display = '';

  /* ── Collapse / expand toggle ──────────────────────────── */

  const toggleBtn  = document.getElementById('imageManagerToggle');
  const panel      = document.getElementById('imageManagerPanel');
  const chevron    = document.getElementById('imageManagerChevron');

  if (toggleBtn && panel && chevron) {
    toggleBtn.addEventListener('click', () => {
      // Read current expanded state from aria attribute
      const isOpen = toggleBtn.getAttribute('aria-expanded') === 'true';

      if (isOpen) {
        // Collapse
        panel.style.display = 'none';
        panel.setAttribute('aria-hidden', 'true');
        toggleBtn.setAttribute('aria-expanded', 'false');
        chevron.style.transform = 'rotate(0deg)';
      } else {
        // Expand
        panel.style.display = '';
        panel.setAttribute('aria-hidden', 'false');
        toggleBtn.setAttribute('aria-expanded', 'true');
        chevron.style.transform = 'rotate(180deg)';
      }
    });
  }

  /* ── SECTION 1: Upload a new image ────────────────────── */

  const fileInput    = document.getElementById('imgUploadInput');
  const uploadLabel  = document.getElementById('imgUploadLabel');
  const previewWrap  = document.getElementById('imgPreviewWrap');
  const previewImg   = document.getElementById('imgPreview');
  const previewName  = document.getElementById('imgPreviewName');
  const uploadBtn    = document.getElementById('imgUploadBtn');
  const resultWrap   = document.getElementById('imgUploadResult');
  const uploadedUrl  = document.getElementById('imgUploadedUrl');
  const copyUrlBtn   = document.getElementById('imgCopyUrlBtn');

  // Auto-fill targets (Section 2)
  const assignUrlInput  = document.getElementById('assignImageUrl');
  const assignHint      = document.getElementById('assignAutoFillHint');

  // When user selects a file — show preview and enable upload button
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;

      // Validate type client-side before upload
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        alert('Please choose a JPG, PNG, or WebP image.');
        fileInput.value = '';
        return;
      }

      // Validate size client-side (5 MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File is too large. Maximum size is 5 MB.');
        fileInput.value = '';
        return;
      }

      // Show preview image using FileReader
      const reader = new FileReader();
      reader.onload = (e) => {
        if (previewImg)  previewImg.src  = e.target.result;
        if (previewName) previewName.textContent = file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
        if (previewWrap) previewWrap.style.display = '';
      };
      reader.readAsDataURL(file);

      // Enable the upload button now that a valid file is selected
      if (uploadBtn) uploadBtn.disabled = false;

      // Highlight label border to give selected feedback
      if (uploadLabel) uploadLabel.style.borderColor = 'var(--color-accent-sage, #7A9E7E)';
    });
  }

  // Upload button — sends file to /api/upload/product
  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      const file = fileInput && fileInput.files[0];
      if (!file) return;

      // Show uploading state
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Uploading…';

      try {
        // Build FormData — key must be 'image' to match server expectation
        const formData = new FormData();
        formData.append('image', file);

        // Call the existing upload endpoint via the api.upload wrapper
        const result = await window.api.upload('/upload/product', formData);

        // result.image_url is the served path, e.g. /uploads/products/product_1234.jpg
        const resolvedUrl = result.image_url;

        // Show the result URL field
        if (uploadedUrl) uploadedUrl.value = resolvedUrl;
        if (resultWrap)  resultWrap.style.display = '';

        // Auto-fill Section 2's URL field for quick assign workflow
        if (assignUrlInput) {
          assignUrlInput.value = resolvedUrl;
          // Update assign preview
          triggerAssignPreview(resolvedUrl);
        }
        // Show the auto-fill hint
        if (assignHint) assignHint.style.display = '';

        // Toast success feedback
        if (window.Toast) window.Toast.show('Image uploaded successfully!', 'success');

        // Reset file input and upload button label
        uploadBtn.textContent = 'Upload Another';
        uploadBtn.disabled = false;
        if (uploadLabel) uploadLabel.style.borderColor = '';

      } catch (err) {
        // Show error — don't crash the page
        alert('Upload failed: ' + (err.message || 'Unknown error'));
        uploadBtn.textContent = 'Upload Image';
        uploadBtn.disabled = false;
      }
    });
  }

  // Copy URL button — copies the uploaded URL to clipboard
  if (copyUrlBtn && uploadedUrl) {
    copyUrlBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(uploadedUrl.value);
        copyUrlBtn.textContent = 'Copied!';
        setTimeout(() => { copyUrlBtn.textContent = 'Copy'; }, 1800);
      } catch {
        // Fallback for older browsers — select text
        uploadedUrl.select();
        document.execCommand('copy');
        copyUrlBtn.textContent = 'Copied!';
        setTimeout(() => { copyUrlBtn.textContent = 'Copy'; }, 1800);
      }
    });
  }

  /* ── SECTION 2: Assign image URL to a product ─────────── */

  const assignProductId  = document.getElementById('assignProductId');
  const assignPreviewWrap = document.getElementById('assignPreviewWrap');
  const assignPreviewImg  = document.getElementById('assignPreview');
  const assignBtn        = document.getElementById('assignImageBtn');
  const assignFeedback   = document.getElementById('assignFeedback');

  // Helper: update the assign preview when URL input changes
  function triggerAssignPreview(url) {
    if (!url || !url.trim()) {
      if (assignPreviewWrap) assignPreviewWrap.style.display = 'none';
      return;
    }
    // Resolve relative paths to full URL for the preview img src
    const fullUrl = url.startsWith('http') ? url : `${window.VAVH.API_BASE_URL.replace('/api', '')}${url}`;
    if (assignPreviewImg) assignPreviewImg.src = fullUrl;
    if (assignPreviewWrap) assignPreviewWrap.style.display = '';
  }

  // Live preview update as user types URL
  if (assignUrlInput) {
    assignUrlInput.addEventListener('input', () => {
      triggerAssignPreview(assignUrlInput.value.trim());
      // Hide the auto-fill hint once the user manually edits
      if (assignHint) assignHint.style.display = 'none';
    });
  }

  // Assign button — PATCH product's image_url via the admin products API
  if (assignBtn) {
    assignBtn.addEventListener('click', async () => {
      const productId = assignProductId && assignProductId.value.trim();
      const imageUrl  = assignUrlInput  && assignUrlInput.value.trim();

      // Client-side validation
      if (!productId || isNaN(Number(productId)) || Number(productId) < 1) {
        showAssignFeedback('Please enter a valid product ID.', false);
        return;
      }
      if (!imageUrl) {
        showAssignFeedback('Please enter an image URL or upload an image first.', false);
        return;
      }

      // Show saving state
      assignBtn.disabled = true;
      assignBtn.textContent = 'Saving…';

      try {
        // Use the admin products update endpoint (PUT /api/admin/products/:id)
        // which already exists and is used by the Admin Panel
        await window.api.put(`/admin/products/${productId}`, { image_url: imageUrl });

        showAssignFeedback(`✓ Product #${productId} image updated successfully.`, true);

        // Refresh the product grid so the new image is visible immediately
        // Re-fetch all products to pick up the change
        const freshData = await window.api.get('/products');
        const freshProducts = freshData.products || freshData;
        if (window.renderProductGrid) {
          const grid = document.getElementById('productsGrid');
          window.renderProductGrid(grid, freshProducts);
        }

      } catch (err) {
        showAssignFeedback('Error: ' + (err.message || 'Could not update product.'), false);
      } finally {
        assignBtn.disabled = false;
        assignBtn.textContent = 'Save Image to Product';
      }
    });
  }

  // Helper: display feedback message with success/error styling
  function showAssignFeedback(message, isSuccess) {
    if (!assignFeedback) return;
    assignFeedback.textContent  = message;
    assignFeedback.style.display = '';
    // Success = soft green; error = soft red — matching existing site palette
    if (isSuccess) {
      assignFeedback.style.background = 'rgba(122,158,126,0.12)';
      assignFeedback.style.border     = '1px solid rgba(122,158,126,0.4)';
      assignFeedback.style.color      = '#3D6B41';
    } else {
      assignFeedback.style.background = 'rgba(200,80,80,0.08)';
      assignFeedback.style.border     = '1px solid rgba(200,80,80,0.3)';
      assignFeedback.style.color      = '#8B3A3A';
    }
    // Auto-hide after 6 seconds
    setTimeout(() => {
      if (assignFeedback) assignFeedback.style.display = 'none';
    }, 6000);
  }
}
