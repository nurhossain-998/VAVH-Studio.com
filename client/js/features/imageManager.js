/* ============================================================
   js/features/imageManager.js — Image Management for Products
   Allows admin users to upload, manage, and preview images
   ============================================================ */

const ImageManager = (() => {
  let isAdminUser = false;

  /**
   * Initialize image manager on products page
   */
  function init() {
    // Check if user is admin
    const user = window.Storage?.getUser?.();
    isAdminUser = user?.role === 'admin';

    if (!isAdminUser) {
      console.log('[ImageManager] Not an admin user, hiding image manager');
      return;
    }

    console.log('[ImageManager] Initializing for admin user');

    // Show image manager UI
    const wrap = document.getElementById('imageManagerWrap');
    if (wrap) {
      wrap.style.display = 'block';
      setupImageManager();
    }
  }

  /**
   * Set up image manager UI and event listeners
   */
  function setupImageManager() {
    const toggle = document.getElementById('imageManagerToggle');
    const panel = document.getElementById('imageManagerPanel');
    const chevron = document.getElementById('imageManagerChevron');

    // Toggle panel visibility
    if (toggle) {
      toggle.addEventListener('click', () => {
        const isHidden = panel.style.display === 'none';
        panel.style.display = isHidden ? 'block' : 'none';
        toggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
        
        if (chevron) {
          chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        }
      });
    }

    // File upload handler
    const fileInput = document.getElementById('imgUploadInput');
    const uploadLabel = document.getElementById('imgUploadLabel');

    if (fileInput && uploadLabel) {
      // Click to upload
      uploadLabel.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
      });

      // File selected
      fileInput.addEventListener('change', handleFileSelect);

      // Drag and drop
      uploadLabel.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadLabel.style.borderColor = 'var(--color-primary)';
        uploadLabel.style.background = 'rgba(122, 114, 107, 0.05)';
      });

      uploadLabel.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadLabel.style.borderColor = 'var(--color-border)';
        uploadLabel.style.background = 'transparent';
      });

      uploadLabel.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadLabel.style.borderColor = 'var(--color-border)';
        uploadLabel.style.background = 'transparent';

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          fileInput.files = files;
          handleFileSelect();
        }
      });
    }

    // ── Assign Image section ────────────────────────────────────
    const assignProductIdInput = document.getElementById('assignProductId');
    const assignImageUrlInput = document.getElementById('assignImageUrl');
    const assignImageBtn = document.getElementById('assignImageBtn');
    const assignPreviewWrap = document.getElementById('assignPreviewWrap');
    const assignPreview = document.getElementById('assignPreview');

    // Show preview when URL changes
    if (assignImageUrlInput) {
      assignImageUrlInput.addEventListener('input', () => {
        const url = assignImageUrlInput.value.trim();
        if (url && (url.startsWith('http') || url.startsWith('/'))) {
          if (assignPreview) {
            assignPreview.src = url;
            assignPreview.onerror = function() {
              assignPreviewWrap.style.display = 'none';
            };
          }
          if (assignPreviewWrap) assignPreviewWrap.style.display = 'block';
        } else {
          if (assignPreviewWrap) assignPreviewWrap.style.display = 'none';
        }
      });
    }

    // Assign image to product button
    if (assignImageBtn) {
      assignImageBtn.addEventListener('click', assignImageToProduct);
    }
  }

  /**
   * Handle file selection and preview
   */
  async function handleFileSelect() {
    const fileInput = document.getElementById('imgUploadInput');
    const previewWrap = document.getElementById('imgPreviewWrap');
    const previewImg = previewWrap?.querySelector('img');
    const uploadBtn = document.getElementById('imgUploadBtn');

    if (!fileInput.files || fileInput.files.length === 0) {
      if (uploadBtn) uploadBtn.disabled = true;
      return;
    }

    const file = fileInput.files[0];

    console.log('[ImageManager] File selected:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // Validation
    if (!isValidImageFile(file)) {
      window.Toast?.error?.(`Invalid file. Only JPG, PNG, WebP allowed.`);
      fileInput.value = '';
      if (uploadBtn) uploadBtn.disabled = true;
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      if (previewImg) {
        previewImg.src = e.target.result;
        if (previewWrap) previewWrap.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);

    // Enable upload button
    if (uploadBtn) {
      uploadBtn.disabled = false;
    }
  }

  /**
   * Validate image file
   */
  function isValidImageFile(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      console.error('[ImageManager] Invalid MIME type:', file.type);
      return false;
    }

    if (file.size > maxSize) {
      console.error('[ImageManager] File too large:', file.size);
      window.Toast?.error?.(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 5MB)`);
      return false;
    }

    return true;
  }

  /**
   * Upload image file
   */
  async function uploadImage() {
    const fileInput = document.getElementById('imgUploadInput');
    const uploadBtn = document.getElementById('imgUploadBtn');
    const statusDiv = document.getElementById('imgUploadStatus');

    if (!fileInput.files || fileInput.files.length === 0) {
      window.Toast?.error?.('Please select an image first.');
      return;
    }

    const file = fileInput.files[0];

    // Create FormData
    const formData = new FormData();
    formData.append('image', file);

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading…';

    try {
      console.log('[ImageManager] Uploading image…');
      const data = await window.api.upload('/upload/product', formData);

      console.log('[ImageManager] Upload successful:', data);

      // Store the image URL for later use
      window.lastUploadedImage = {
        url: data.image_url,
        filename: data.filename,
        size: data.size,
        uploadedAt: new Date(),
      };

      // Auto-fill the assign image URL field
      const assignImageUrlInput = document.getElementById('assignImageUrl');
      if (assignImageUrlInput) {
        assignImageUrlInput.value = data.image_url;
        // Trigger preview update
        assignImageUrlInput.dispatchEvent(new Event('input'));
        // Show hint
        const hint = document.getElementById('assignAutoFillHint');
        if (hint) hint.style.display = 'inline';
      }

      // Show success with copy button
      if (statusDiv) {
        statusDiv.innerHTML = `
          <div style="
            background: var(--color-success, #10b981);
            color: white;
            padding: var(--space-4);
            border-radius: var(--radius-md);
            margin-top: var(--space-3);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--space-3);
          ">
            <div>
              <strong>✓ Upload successful!</strong><br/>
              <code style="font-size: var(--text-xs); opacity: 0.9; word-break: break-all;">
                ${data.image_url}
              </code>
            </div>
            <button 
              type="button"
              class="btn btn-sm" 
              style="background: rgba(255,255,255,0.2); color: white; flex-shrink: 0;"
              onclick="ImageManager.copyImageUrl('${data.image_url}')"
            >
              Copy URL
            </button>
          </div>
        `;
      }

      window.Toast?.success?.('✓ Image uploaded! URL ready to paste.');

      // Reset form
      fileInput.value = '';
      uploadBtn.textContent = 'Upload Image';

    } catch (err) {
      console.error('[ImageManager] Upload error:', err);
      if (statusDiv) {
        statusDiv.innerHTML = `
          <div style="
            background: var(--color-danger, #ef4444);
            color: white;
            padding: var(--space-4);
            border-radius: var(--radius-md);
            margin-top: var(--space-3);
          ">
            <strong>✗ Upload failed</strong><br/>
            ${err.message}
          </div>
        `;
      }
      window.Toast?.error?.(`Upload failed: ${err.message}`);
    } finally {
      uploadBtn.disabled = false;
      if (uploadBtn.textContent === 'Uploading…') {
        uploadBtn.textContent = 'Upload Image';
      }
    }
  }

  /**
   * Copy image URL to clipboard
   */
  function copyImageUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
      window.Toast?.success?.('✓ Image URL copied to clipboard!');
    }).catch(() => {
      window.Toast?.error?.('Failed to copy URL.');
    });
  }

  /**
   * Get last uploaded image info
   */
  function getLastUploadedImage() {
    return window.lastUploadedImage || null;
  }

  /**
   * Assign image URL to a product by ID
   */
  async function assignImageToProduct() {
    const productIdInput = document.getElementById('assignProductId');
    const imageUrlInput = document.getElementById('assignImageUrl');
    const feedbackDiv = document.getElementById('assignFeedback');
    const assignBtn = document.getElementById('assignImageBtn');

    const productId = parseInt(productIdInput?.value || '0');
    const imageUrl = imageUrlInput?.value.trim() || '';

    // Validation
    if (!productId || productId < 1) {
      if (feedbackDiv) {
        feedbackDiv.innerHTML = '<div style="background: var(--color-danger, #ef4444); color: white;">Please enter a valid product ID</div>';
        feedbackDiv.style.display = 'block';
      }
      window.Toast?.error?.('Please enter a valid product ID.');
      return;
    }

    if (!imageUrl) {
      if (feedbackDiv) {
        feedbackDiv.innerHTML = '<div style="background: var(--color-danger, #ef4444); color: white;">Please enter an image URL</div>';
        feedbackDiv.style.display = 'block';
      }
      window.Toast?.error?.('Please enter an image URL.');
      return;
    }

    if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
      if (feedbackDiv) {
        feedbackDiv.innerHTML = '<div style="background: var(--color-danger, #ef4444); color: white;">Image URL must start with http://, https://, or /</div>';
        feedbackDiv.style.display = 'block';
      }
      window.Toast?.error?.('Invalid image URL format.');
      return;
    }

    console.log('[ImageManager] Assigning image to product:', { productId, imageUrl });

    assignBtn.disabled = true;
    assignBtn.textContent = 'Saving…';

    try {
      // Update product with new image URL
      const response = await window.api.put(`/admin/products/${productId}`, {
        image_url: imageUrl
      });

      console.log('[ImageManager] Image assigned successfully');

      if (feedbackDiv) {
        feedbackDiv.innerHTML = `<div style="background: var(--color-success, #10b981); color: white;">✓ Image assigned to product #${productId}</div>`;
        feedbackDiv.style.display = 'block';
      }

      window.Toast?.success?.(`✓ Image assigned to product #${productId}`);

      // Clear form
      productIdInput.value = '';
      imageUrlInput.value = '';
      document.getElementById('assignPreviewWrap').style.display = 'none';

    } catch (err) {
      console.error('[ImageManager] Error assigning image:', err);

      if (feedbackDiv) {
        feedbackDiv.innerHTML = `<div style="background: var(--color-danger, #ef4444); color: white;">✗ Failed: ${err.message}</div>`;
        feedbackDiv.style.display = 'block';
      }

      window.Toast?.error?.(`Failed to assign image: ${err.message}`);

    } finally {
      assignBtn.disabled = false;
      assignBtn.textContent = 'Save Image to Product';
    }
  }

  // ── Public API ──────────────────────────────────────────
  return {
    init,
    uploadImage,
    copyImageUrl,
    getLastUploadedImage,
    assignImageToProduct,
  };
})();

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ImageManager.init);
} else {
  ImageManager.init();
}

// Expose globally
window.ImageManager = ImageManager;
