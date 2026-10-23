/* ============================================================
   js/pages/register.js — Registration Form Logic for VAVH.Studio
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // Redirect if already logged in
  if (window.Storage.isLoggedIn()) {
    window.location.href = 'dashboard.html';
    return;
  }

  // DOM references
  const form       = document.getElementById('registerForm');
  const nameInput  = document.getElementById('regName');
  const emailInput = document.getElementById('regEmail');
  const phoneInput = document.getElementById('regPhone');
  const addrInput  = document.getElementById('regAddress');
  const passInput  = document.getElementById('regPassword');
  const confInput  = document.getElementById('regConfirm');
  const submitBtn  = document.getElementById('registerSubmitBtn');
  const spinner    = document.getElementById('registerSpinner');
  const btnText    = document.getElementById('registerBtnText');
  const regErr     = document.getElementById('registerError');
  const toggleBtn  = document.getElementById('toggleRegPassword');

  // Password visibility toggle
  toggleBtn?.addEventListener('click', () => {
    const isPass = passInput.type === 'password';
    passInput.type = isPass ? 'text' : 'password';
  });

  // Validate all fields
  function validate() {
    let valid = true;

    // Name validation
    const nameErr = document.getElementById('nameError');
    if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
      nameErr.textContent = 'Please enter your full name.';
      nameErr.classList.remove('hidden');
      valid = false;
    } else { nameErr.classList.add('hidden'); }

    // Email validation
    const emailErr = document.getElementById('regEmailError');
    if (!window.Helpers.isValidEmail(emailInput.value)) {
      emailErr.textContent = 'Please enter a valid email address.';
      emailErr.classList.remove('hidden');
      valid = false;
    } else { emailErr.classList.add('hidden'); }

    // Password strength
    const passErr = document.getElementById('regPasswordError');
    if (!window.Helpers.isValidPassword(passInput.value)) {
      passErr.textContent = 'Password must be at least 8 characters.';
      passErr.classList.remove('hidden');
      valid = false;
    } else { passErr.classList.add('hidden'); }

    // Confirm password match
    const confErr = document.getElementById('confirmError');
    if (passInput.value !== confInput.value) {
      confErr.textContent = 'Passwords do not match.';
      confErr.classList.remove('hidden');
      valid = false;
    } else { confErr.classList.add('hidden'); }

    return valid;
  }

  // Form submit handler
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    regErr.classList.add('hidden');

    if (!validate()) return;

    spinner.classList.remove('hidden');
    btnText.textContent = 'Creating account…';
    submitBtn.disabled = true;

    try {
      const result = await window.api.post('/auth/register', {
        name:     nameInput.value.trim(),
        email:    emailInput.value.trim(),
        phone:    phoneInput.value.trim(),
        address:  addrInput.value.trim(),
        password: passInput.value,
      });

      // Auto-login after registration
      window.Storage.setToken(result.token);
      window.Storage.setUser(result.user);

      window.Toast.success('Account created! Welcome to VAVH.Studio 🎉');
      setTimeout(() => window.location.href = 'dashboard.html', 900);

    } catch (err) {
      regErr.textContent = err.message || 'Registration failed. Please try again.';
      regErr.classList.remove('hidden');
    } finally {
      spinner.classList.add('hidden');
      btnText.textContent = 'Create Account';
      submitBtn.disabled = false;
    }
  });
});
