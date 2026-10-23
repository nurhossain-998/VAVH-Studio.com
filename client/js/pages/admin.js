/* ============================================================
   js/pages/admin.js — Hidden Admin Panel for VAVH.Studio
   Access: CTRL + SHIFT + A  — NOT linked anywhere in the UI
   ============================================================ */

(function () {

  // ── Secret keyboard shortcut listener ─────────────────────
  // Listen for Ctrl + Shift + A to open admin panel
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      // Admin must be logged in with admin role
      const user = window.Storage.getUser();
      if (!user) {
        window.Toast.error('Please sign in first.');
        return;
      }
      if (user.role !== 'admin' && user.role !== 'Admin' && user.role !== 'Super Admin') {
        window.Toast.error('Admin access required.');
        return;
      }
      openAdminPanel();
    }
  });

  // ── Auto-open via URL param (?admin=open) ─────────────────
  // Used when "Website Management" link is clicked from dashboard
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'open') {
      // Remove the param from the URL without reloading
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);

      // Wait a tick for all other scripts to initialise
      setTimeout(() => {
        const user = window.Storage.getUser();
        if (!user) {
          window.Toast.error('Please sign in to access Website Management.');
          return;
        }
        if (user.role !== 'admin' && user.role !== 'Admin' && user.role !== 'Super Admin') {
          window.Toast.error('Admin access required.');
          return;
        }
        openAdminPanel();
      }, 200);
    }
  });

  // ── Open admin panel ──────────────────────────────────────
  function openAdminPanel() {
    const panel = document.getElementById('adminPanel');
    if (!panel) {
      window.location.href = '/admin';
      return;
    }
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    // Prevent body scroll behind panel
    document.body.style.overflow = 'hidden';
    // Load default tab (products)
    loadAdminTab('products');
  }

  // ── Close admin panel ─────────────────────────────────────
  document.getElementById('adminClose')?.addEventListener('click', () => {
    const panel = document.getElementById('adminPanel');
    if (!panel) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  });

  // ── Sidebar tab navigation ─────────────────────────────────
  document.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all tabs
      document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadAdminTab(btn.dataset.adminTab);
    });
  });

  // ── Load admin tab content ─────────────────────────────────
  async function loadAdminTab(tab) {
    const content = document.getElementById('adminContent');
    if (!content) return;

    // Show loading spinner
    content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>`;

    switch (tab) {
      case 'products':   await renderAdminProducts(content);   break;
      case 'categories': await renderAdminCategories(content); break;
      case 'orders':     await renderAdminOrders(content);     break;
      case 'services':   await renderAdminServices(content);   break;
      case 'about':      await renderAdminAbout(content);      break;
      default:
        content.innerHTML = `<p>Unknown tab.</p>`;
    }
  }

  // ══════════════════════════════════════════════════════════
  // PRODUCTS MANAGEMENT
  // ══════════════════════════════════════════════════════════

  async function renderAdminProducts(container) {
    try {
      const products = await window.api.get('/admin/products');
      let categories = [];
      try {
        categories = await window.api.get('/categories');
      } catch (err) {
        console.error('[Admin] Failed to load categories for dropdown:', err);
      }
      
      const categoryOptions = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6);">
          <h2 style="font-family:var(--font-heading);font-size:var(--text-xl);">Products</h2>
          <button class="btn btn-primary btn-sm" id="addProductBtn">+ Add Product</button>
        </div>

        <!-- Product form (hidden by default) -->
        <div id="productFormWrap" style="display:none;background:var(--color-surface);border-radius:var(--radius-xl);padding:var(--space-6);margin-bottom:var(--space-6);">
          <h3 style="font-size:var(--text-lg);margin-bottom:var(--space-4);" id="productFormTitle">Add Product</h3>
          <form id="productForm" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);">
            <input type="hidden" id="productId" />
            <div class="form-group">
              <label class="form-label">Name</label>
              <input type="text" id="prodName" class="form-input" placeholder="Product name" required />
            </div>
            <div class="form-group">
              <label class="form-label">Price (৳)</label>
              <input type="number" id="prodPrice" class="form-input" placeholder="0" required min="0" />
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <select id="prodCategory" class="form-select">
                <option value="">Select category</option>
                ${categoryOptions}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Product Image</label>
              <div style="display:flex;gap:var(--space-3);align-items:flex-end;">
                <div style="flex:1;">
                  <input type="file" id="prodImageFile" class="form-input" accept="image/*" />
                  <small style="color:var(--color-text-muted);display:block;margin-top:4px;">JPG, PNG, WebP (max 5MB)</small>
                </div>
                <button type="button" id="uploadImageBtn" class="btn btn-primary btn-sm" style="height:fit-content;white-space:nowrap;">Upload</button>
              </div>
              <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:8px;margin-bottom:8px;">OR paste image URL:</p>
              <input type="text" id="prodImage" class="form-input" placeholder="/images/product.jpg or https://…" />
              <div id="imgPreviewWrap" style="display:none; margin-top:12px; border:1px solid var(--color-border); padding:8px; border-radius:var(--radius-md); width:max-content;">
                <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:4px;">Image Preview:</p>
                <img src="" style="max-height:100px; border-radius:4px; object-fit:contain;" onerror="this.style.display='none'" onload="this.style.display='block'" />
              </div>
            </div>
            <div class="form-group" style="grid-column:1/-1;">
              <label class="form-label">Description</label>
              <textarea id="prodDesc" class="form-textarea" placeholder="Product description…"></textarea>
            </div>
            <div class="form-group" style="display:flex;align-items:center;gap:var(--space-2);">
              <input type="checkbox" id="prodFeatured" style="width:18px;height:18px;cursor:pointer;" />
              <label class="form-label" for="prodFeatured" style="margin:0;cursor:pointer;">Mark as Featured</label>
            </div>
            <div style="grid-column:1/-1;display:flex;gap:var(--space-3);">
              <button type="submit" class="btn btn-primary btn-sm" id="productSaveBtn">Save Product</button>
              <button type="button" class="btn btn-ghost btn-sm" id="productCancelBtn">Cancel</button>
            </div>
          </form>
        </div>

        <!-- Products table -->
        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="productsTableBody"></tbody>
          </table>
        </div>
      `;

      // Populate table
      const tbody = document.getElementById('productsTableBody');
      products.forEach(p => {
        const tr = document.createElement('tr');
        const imageUrl = window.Helpers.productImage(p.image_url);
        tr.innerHTML = `
          <td>
            <img 
              src="${imageUrl}" 
              class="admin-img-thumb" 
              alt="${p.name}"
              style="width:60px;height:60px;object-fit:cover;border-radius:4px;background:#f0f0f0;" 
              onerror="this.src='${window.VAVH.DEFAULT_PRODUCT_IMG}'"
            />
          </td>
          <td style="font-weight:var(--fw-medium);">${p.name}</td>
          <td><span class="badge badge-sage">${p.category_name || '—'}</span></td>
          <td>${window.Helpers.formatPrice(p.price)}</td>
          <td style="display:flex;gap:var(--space-2);">
            <button class="btn btn-ghost btn-sm edit-product-btn" data-id="${p.id}">Edit</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" data-id="${p.id}" onclick="window.AdminActions.deleteProduct(${p.id}, this)">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Add product button
      document.getElementById('addProductBtn')?.addEventListener('click', () => {
        showProductForm(null);
      });

      // Cancel form
      document.getElementById('productCancelBtn')?.addEventListener('click', () => {
        document.getElementById('productFormWrap').style.display = 'none';
      });

      // Edit product buttons
      document.querySelectorAll('.edit-product-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const prod = products.find(p => p.id == btn.dataset.id);
          if (prod) showProductForm(prod);
        });
      });

      // Preview image on select
      document.getElementById('prodImageFile')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const wrap = document.getElementById('imgPreviewWrap');
            const img = wrap?.querySelector('img');
            if (wrap && img) {
              img.src = e.target.result;
              wrap.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        }
      });

      // Upload image button handler
      document.getElementById('uploadImageBtn')?.addEventListener('click', async () => {
        const fileInput = document.getElementById('prodImageFile');
        const uploadBtn = document.getElementById('uploadImageBtn');
        const imageUrlField = document.getElementById('prodImage');
        
        // Validation: Check if file selected
        if (!fileInput.files || fileInput.files.length === 0) {
          window.Toast.error('Please select an image file first.');
          return;
        }

        const file = fileInput.files[0];

        console.log('[Admin] Uploading file:', {
          name: file.name,
          size: file.size,
          type: file.type,
        });

        // Validation: File size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          window.Toast.error(`File size must be less than 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`);
          return;
        }

        // Validation: File type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
          window.Toast.error(`Invalid file type: ${file.type}. Only JPG, PNG, and WebP are allowed.`);
          return;
        }

        // Create FormData for multipart upload
        const formData = new FormData();
        formData.append('image', file);

        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading…';

        try {
          console.log('[Admin] Sending upload request…');
          const data = await window.api.upload('/upload/product', formData);

          console.log('[Admin] Upload successful:', data);

          // Set the image URL in the form
          imageUrlField.value = data.image_url;

          // Show success toast with image preview
          window.Toast.success(`✓ Image uploaded successfully!`);

          // Clear the file input
          fileInput.value = '';

          // Show image preview if there's a preview area
          const imgPreview = document.getElementById('imgPreviewWrap');
          if (imgPreview && imgPreview.querySelector('img')) {
            imgPreview.querySelector('img').src = data.image_url;
            imgPreview.style.display = 'block';
          }

        } catch (err) {
          console.error('[Admin] Upload error:', err);
          window.Toast.error(`Upload failed: ${err.message}`);
          imageUrlField.value = ''; // Clear on error
        } finally {
          uploadBtn.disabled = false;
          uploadBtn.textContent = 'Upload';
        }
      });

      // Form submit — create or update product
      document.getElementById('productForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('productSaveBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        // Auto-upload if a file is selected
        const fileInput = document.getElementById('prodImageFile');
        let imageUrl = document.getElementById('prodImage').value.trim();
        
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          const formData = new FormData();
          formData.append('image', file);
          try {
            console.log('[Admin] Auto-uploading selected image before save...');
            const data = await window.api.upload('/upload/product', formData);
            imageUrl = data.image_url;
            document.getElementById('prodImage').value = imageUrl;
            // Clear input so it doesn't upload again next time
            fileInput.value = '';
          } catch (err) {
            console.error('[Admin] Auto-upload error:', err);
            window.Toast.error(`Upload failed: ${err.message}`);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Product';
            return;
          }
        }

        const id      = document.getElementById('productId').value;
        const rawPrice = document.getElementById('prodPrice').value;
        const price = rawPrice === '' ? null : parseFloat(rawPrice);
        const payload = {
          name:        document.getElementById('prodName').value.trim(),
          price,
          category:    document.getElementById('prodCategory').value,
          image_url:   imageUrl,
          description: document.getElementById('prodDesc').value.trim(),
          is_featured: document.getElementById('prodFeatured').checked ? 1 : 0,
        };

        // ── Validation ────────────────────────────────────────
        if (!payload.name) {
          window.Toast.error('Product name is required.');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Product';
          return;
        }

        if (price === null || Number.isNaN(price)) {
          window.Toast.error('Product price is required.');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Product';
          return;
        }

        if (price < 0) {
          window.Toast.error('Price must be 0 or greater.');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Product';
          return;
        }

        if (payload.image_url && !payload.image_url.startsWith('http') && !payload.image_url.startsWith('/')) {
          window.Toast.error('Image URL must be a valid URL starting with http://, https://, or /');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Product';
          return;
        }

        console.log('[Admin] Submitting product:', payload);

        try {
          if (id) {
            console.log(`[Admin] Updating product ${id}`);
            await window.api.put(`/admin/products/${id}`, payload);
            window.Toast.success('✓ Product updated successfully!');
          } else {
            console.log('[Admin] Creating new product');
            const result = await window.api.post('/admin/products', payload);
            window.Toast.success('✓ Product created successfully!');
            console.log('[Admin] New product created:', result);
          }
          
          // Reset form and reload products tab
          document.getElementById('productFormWrap').style.display = 'none';
          loadAdminTab('products');
        } catch (err) {
          console.error('[Admin] Save error:', err);
          window.Toast.error(`Save failed: ${err.message}`);
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Product';
        }
      });

    } catch (err) {
      container.innerHTML = `<p style="color:var(--color-danger);">Error loading products: ${err.message}</p>`;
    }
  }

  // Show product form pre-filled for edit, or blank for add
  function showProductForm(product) {
    const wrap = document.getElementById('productFormWrap');
    wrap.style.display = 'block';
    
    const titleEl = document.getElementById('productFormTitle');
    const idField = document.getElementById('productId');
    const nameField = document.getElementById('prodName');
    const priceField = document.getElementById('prodPrice');
    const catField = document.getElementById('prodCategory');
    const imgField = document.getElementById('prodImage');
    const descField = document.getElementById('prodDesc');
    const featuredField = document.getElementById('prodFeatured');
    const fileInput = document.getElementById('prodImageFile');
    const previewWrap = document.getElementById('imgPreviewWrap');

    if (product) {
      titleEl.textContent = 'Edit Product';
      idField.value = product.id;
      nameField.value = product.name || '';
      priceField.value = product.price || '';
      catField.value = product.category_name || '';
      imgField.value = product.image_url || '';
      descField.value = product.description || '';
      featuredField.checked = product.is_featured === 1;
      
      if (product.image_url && previewWrap) {
        const img = previewWrap.querySelector('img');
        if (img) img.src = window.Helpers.productImage(product.image_url);
        previewWrap.style.display = 'block';
      }
    } else {
      titleEl.textContent = 'Add Product';
      idField.value = '';
      nameField.value = '';
      priceField.value = '';
      catField.value = '';
      imgField.value = '';
      descField.value = '';
      featuredField.checked = false;
      if (previewWrap) previewWrap.style.display = 'none';
    }

    // Clear file input
    fileInput.value = '';

    // Scroll to form
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ══════════════════════════════════════════════════════════
  // CATEGORIES MANAGEMENT
  // ══════════════════════════════════════════════════════════

  async function renderAdminCategories(container) {
    try {
      const cats = await window.api.get('/categories');

      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6);">
          <h2 style="font-family:var(--font-heading);font-size:var(--text-xl);">Categories</h2>
          <button class="btn btn-primary btn-sm" id="addCatBtn">+ Add Category</button>
        </div>

        <!-- Add/edit form -->
        <div id="catFormWrap" style="display:none;background:var(--color-surface);border-radius:var(--radius-xl);padding:var(--space-5);margin-bottom:var(--space-5);">
          <form id="catForm" style="display:flex;gap:var(--space-4);align-items:flex-end;">
            <input type="hidden" id="catId" />
            <div class="form-group" style="flex:1;">
              <label class="form-label">Category Name</label>
              <input type="text" id="catName" class="form-input" placeholder="e.g. LED Mirror" required />
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Save</button>
            <button type="button" class="btn btn-ghost btn-sm" id="catCancel">Cancel</button>
          </form>
        </div>

        <!-- Categories list -->
        <div id="catList" style="display:flex;flex-direction:column;gap:var(--space-2);"></div>
      `;

      const catList = document.getElementById('catList');
      cats.forEach(cat => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) var(--space-4);background:var(--color-surface);border-radius:var(--radius-md);';
        row.innerHTML = `
          <span style="font-weight:var(--fw-medium);">${cat.name}</span>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-ghost btn-sm edit-cat-btn" data-id="${cat.id}" data-name="${cat.name}">Edit</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" onclick="window.AdminActions.deleteCategory(${cat.id}, this)">Delete</button>
          </div>
        `;
        catList.appendChild(row);
      });

      // Add category button
      document.getElementById('addCatBtn')?.addEventListener('click', () => {
        document.getElementById('catFormWrap').style.display = 'block';
        document.getElementById('catId').value = '';
        document.getElementById('catName').value = '';
      });

      // Cancel
      document.getElementById('catCancel')?.addEventListener('click', () => {
        document.getElementById('catFormWrap').style.display = 'none';
      });

      // Edit buttons
      document.querySelectorAll('.edit-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('catFormWrap').style.display = 'block';
          document.getElementById('catId').value = btn.dataset.id;
          document.getElementById('catName').value = btn.dataset.name;
        });
      });

      // Form submit
      document.getElementById('catForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id   = document.getElementById('catId').value;
        const name = document.getElementById('catName').value.trim();
        try {
          if (id) {
            await window.api.put(`/admin/categories/${id}`, { name });
          } else {
            await window.api.post('/admin/categories', { name });
          }
          window.Toast.success('Category saved.');
          loadAdminTab('categories');
        } catch (err) {
          window.Toast.error(err.message || 'Save failed.');
        }
      });

    } catch (err) {
      container.innerHTML = `<p style="color:var(--color-danger);">Error: ${err.message}</p>`;
    }
  }

  // ══════════════════════════════════════════════════════════
  // ORDERS MANAGEMENT
  // ══════════════════════════════════════════════════════════

  async function renderAdminOrders(container) {
    try {
      const orders = await window.api.get('/admin/orders');

      container.innerHTML = `
        <h2 style="font-family:var(--font-heading);font-size:var(--text-xl);margin-bottom:var(--space-6);">All Orders</h2>
        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Update Status</th>
              </tr>
            </thead>
            <tbody id="ordersTableBody"></tbody>
          </table>
        </div>
      `;

      const tbody = document.getElementById('ordersTableBody');
      orders.forEach(order => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:var(--fw-medium);">#${order.id}</td>
          <td>${order.user_name || order.user_email}</td>
          <td>${window.Helpers.formatDate(order.created_at)}</td>
          <td>${window.Helpers.formatPrice(order.total)}</td>
          <td>${window.Orders.statusBadge(order.status)}</td>
          <td>
            <select class="form-select" style="height:32px;font-size:var(--text-xs);padding-inline:var(--space-3);" data-order-id="${order.id}" onchange="window.AdminActions.updateOrderStatus(${order.id}, this.value, this)">
              <option value="pending"    ${order.status === 'pending'    ? 'selected' : ''}>Pending</option>
              <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
              <option value="shipped"    ${order.status === 'shipped'    ? 'selected' : ''}>Shipped</option>
              <option value="delivered"  ${order.status === 'delivered'  ? 'selected' : ''}>Delivered</option>
              <option value="cancelled"  ${order.status === 'cancelled'  ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
        `;
        tbody.appendChild(tr);
      });

    } catch (err) {
      container.innerHTML = `<p style="color:var(--color-danger);">Error: ${err.message}</p>`;
    }
  }

  // ══════════════════════════════════════════════════════════
  // SERVICES MANAGEMENT
  // ══════════════════════════════════════════════════════════

  async function renderAdminServices(container) {
    try {
      const services = await window.api.get('/services');

      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6);">
          <h2 style="font-family:var(--font-heading);font-size:var(--text-xl);">Services</h2>
          <button class="btn btn-primary btn-sm" id="addServiceBtn">+ Add Service</button>
        </div>

        <div id="serviceFormWrap" style="display:none;background:var(--color-surface);border-radius:var(--radius-xl);padding:var(--space-5);margin-bottom:var(--space-5);">
          <form id="serviceForm" style="display:flex;flex-direction:column;gap:var(--space-4);">
            <input type="hidden" id="serviceId" />
            <div class="form-group">
              <label class="form-label">Service Title</label>
              <input type="text" id="svcTitle" class="form-input" required />
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea id="svcDesc" class="form-textarea"></textarea>
            </div>
            <div style="display:flex;gap:var(--space-3);">
              <button type="submit" class="btn btn-primary btn-sm">Save</button>
              <button type="button" class="btn btn-ghost btn-sm" id="svcCancel">Cancel</button>
            </div>
          </form>
        </div>

        <div id="servicesList" style="display:flex;flex-direction:column;gap:var(--space-2);"></div>
      `;

      const listEl = document.getElementById('servicesList');
      services.forEach(svc => {
        const row = document.createElement('div');
        row.style.cssText = 'background:var(--color-surface);border-radius:var(--radius-md);padding:var(--space-4);display:flex;align-items:center;justify-content:space-between;';
        row.innerHTML = `
          <div>
            <p style="font-weight:var(--fw-medium);">${svc.title}</p>
            <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px;">${svc.description?.slice(0,80)}…</p>
          </div>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-ghost btn-sm edit-svc-btn" data-id="${svc.id}" data-title="${svc.title}" data-desc="${svc.description}">Edit</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" onclick="window.AdminActions.deleteService(${svc.id}, this)">Delete</button>
          </div>
        `;
        listEl.appendChild(row);
      });

      document.getElementById('addServiceBtn')?.addEventListener('click', () => {
        document.getElementById('serviceFormWrap').style.display = 'block';
        document.getElementById('serviceId').value = '';
        document.getElementById('svcTitle').value = '';
        document.getElementById('svcDesc').value = '';
      });
      document.getElementById('svcCancel')?.addEventListener('click', () => {
        document.getElementById('serviceFormWrap').style.display = 'none';
      });
      document.querySelectorAll('.edit-svc-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('serviceFormWrap').style.display = 'block';
          document.getElementById('serviceId').value = btn.dataset.id;
          document.getElementById('svcTitle').value  = btn.dataset.title;
          document.getElementById('svcDesc').value   = btn.dataset.desc;
        });
      });
      document.getElementById('serviceForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id      = document.getElementById('serviceId').value;
        const payload = {
          title:       document.getElementById('svcTitle').value.trim(),
          description: document.getElementById('svcDesc').value.trim(),
        };
        try {
          if (id) {
            await window.api.put(`/admin/services/${id}`, payload);
          } else {
            await window.api.post('/admin/services', payload);
          }
          window.Toast.success('Service saved.');
          loadAdminTab('services');
        } catch (err) {
          window.Toast.error(err.message || 'Save failed.');
        }
      });

    } catch (err) {
      container.innerHTML = `<p style="color:var(--color-danger);">Error: ${err.message}</p>`;
    }
  }

  // ══════════════════════════════════════════════════════════
  // ABOUT & SOCIAL LINKS
  // ══════════════════════════════════════════════════════════

  async function renderAdminAbout(container) {
    try {
      const data = await window.api.get('/about');

      container.innerHTML = `
        <h2 style="font-family:var(--font-heading);font-size:var(--text-xl);margin-bottom:var(--space-6);">About & Social Links</h2>

        <!-- About content form -->
        <div style="background:var(--color-surface);border-radius:var(--radius-xl);padding:var(--space-6);margin-bottom:var(--space-6);">
          <h3 style="margin-bottom:var(--space-4);">About Section</h3>
          <form id="aboutForm" style="display:flex;flex-direction:column;gap:var(--space-4);">
            <div class="form-group">
              <label class="form-label">Company Description</label>
              <textarea id="aboutDesc" class="form-textarea" rows="4">${data.description || ''}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Partners (comma-separated)</label>
              <input type="text" id="aboutPartners" class="form-input" value="${data.partners || ''}" />
            </div>
            <button type="submit" class="btn btn-primary btn-sm" style="width:fit-content;">Save About</button>
          </form>
        </div>

        <!-- Social links -->
        <div style="background:var(--color-surface);border-radius:var(--radius-xl);padding:var(--space-6);">
          <h3 style="margin-bottom:var(--space-4);">Social Media Links</h3>
          <form id="socialForm" style="display:flex;flex-direction:column;gap:var(--space-4);">
            ${['instagram','facebook','pinterest','tiktok','youtube'].map(platform => {
              const link = (data.social_links || []).find(l => l.platform === platform);
              return `
                <div class="form-group" style="display:flex;align-items:center;gap:var(--space-3);">
                  <label class="form-label" style="text-transform:capitalize;min-width:90px;">${platform}</label>
                  <input type="url" class="form-input social-input" data-platform="${platform}" placeholder="https://…" value="${link?.url || ''}" />
                </div>
              `;
            }).join('')}
            <button type="submit" class="btn btn-primary btn-sm" style="width:fit-content;">Save Links</button>
          </form>
        </div>
      `;

      // Save about content
      document.getElementById('aboutForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await window.api.put('/admin/about', {
            description: document.getElementById('aboutDesc').value.trim(),
            partners:    document.getElementById('aboutPartners').value.trim(),
          });
          window.Toast.success('About section updated.');
        } catch (err) {
          window.Toast.error(err.message || 'Save failed.');
        }
      });

      // Save social links
      document.getElementById('socialForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const links = [];
        document.querySelectorAll('.social-input').forEach(input => {
          if (input.value.trim()) {
            links.push({ platform: input.dataset.platform, url: input.value.trim() });
          }
        });
        try {
          await window.api.put('/admin/social-links', { links });
          window.Toast.success('Social links updated.');
        } catch (err) {
          window.Toast.error(err.message || 'Save failed.');
        }
      });

    } catch (err) {
      container.innerHTML = `<p style="color:var(--color-danger);">Error: ${err.message}</p>`;
    }
  }

  // ══════════════════════════════════════════════════════════
  // GLOBAL ADMIN ACTION HELPERS
  // (called via inline onclick attributes in table rows)
  // ══════════════════════════════════════════════════════════

  window.AdminActions = {

    // Delete a product after confirmation
    async deleteProduct(id, btnEl) {
      if (!confirm('Delete this product? This cannot be undone.')) return;
      try {
        console.log(`[Admin] Deleting product ID: ${id}`);
        const response = await window.api.delete(`/admin/products/${id}`);
        console.log(`[Admin] Delete response:`, response);
        window.Toast.success('Product deleted.');
        // Reload products list to ensure consistency
        loadAdminTab('products');
      } catch (err) {
        console.error(`[Admin] Delete error:`, err);
        window.Toast.error(err.message || 'Delete failed.');
      }
    },

    // Delete a category after confirmation
    async deleteCategory(id, btnEl) {
      if (!confirm('Delete this category?')) return;
      try {
        await window.api.delete(`/admin/categories/${id}`);
        window.Toast.success('Category deleted.');
        // Reload categories list to ensure consistency
        loadAdminTab('categories');
      } catch (err) {
        window.Toast.error(err.message || 'Delete failed.');
      }
    },

    // Update an order's status
    async updateOrderStatus(orderId, newStatus, selectEl) {
      try {
        await window.api.patch(`/admin/orders/${orderId}/status`, { status: newStatus });
        window.Toast.success(`Order #${orderId} updated to ${newStatus}.`);
      } catch (err) {
        window.Toast.error(err.message || 'Update failed.');
        // Revert select to previous value
        selectEl.value = selectEl.dataset.prev || selectEl.value;
      }
      selectEl.dataset.prev = newStatus;
    },

    // Delete a service
    async deleteService(id, btnEl) {
      if (!confirm('Delete this service?')) return;
      try {
        await window.api.delete(`/admin/services/${id}`);
        window.Toast.success('Service deleted.');
        // Reload services list to ensure consistency
        loadAdminTab('services');
      } catch (err) {
        window.Toast.error(err.message || 'Delete failed.');
      }
    },
  };

})();
