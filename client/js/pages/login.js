/* ============================================================
   js/pages/login.js — Login Form Logic for VAVH.Studio
   Validates inputs, calls auth API, stores JWT on success
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // Redirect to dashboard if already logged in
  if (window.Storage.isLoggedIn()) {
    window.location.href = 'dashboard.html';
    return;
  }

  // DOM references
  const form       = document.getElementById('loginForm');
  const emailInput = document.getElementById('loginEmail');
  const passInput  = document.getElementById('loginPassword');
  const emailErr   = document.getElementById('emailError');
  const passErr    = document.getElementById('passwordError');
  const loginErr   = document.getElementById('loginError');
  const submitBtn  = document.getElementById('loginSubmitBtn');
  const spinner    = document.getElementById('loginSpinner');
  const btnText    = document.getElementById('loginBtnText');
  const toggleBtn  = document.getElementById('togglePassword');

  // ── Password visibility toggle ─────────────────────────────

  if (toggleBtn && passInput) {
    toggleBtn.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
    });
  }

  // ── Form validation ────────────────────────────────────────

  function validate() {
    let valid = true;

    // Validate email
    if (!emailInput.value || !window.Helpers.isValidEmail(emailInput.value)) {
      emailErr.textContent = 'Please enter a valid email address.';
      emailErr.classList.remove('hidden');
      emailInput.classList.add('error');
      valid = false;
    } else {
      emailErr.classList.add('hidden');
      emailInput.classList.remove('error');
    }

    // Validate password
    if (!passInput.value || passInput.value.length < 1) {
      passErr.textContent = 'Please enter your password.';
      passErr.classList.remove('hidden');
      passInput.classList.add('error');
      valid = false;
    } else {
      passErr.classList.add('hidden');
      passInput.classList.remove('error');
    }

    return valid;
  }

  // ── Form submit ────────────────────────────────────────────

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErr.classList.add('hidden');

    if (!validate()) return;

    // Show loading spinner
    spinner.classList.remove('hidden');
    btnText.textContent = 'Signing in…';
    submitBtn.disabled = true;

    try {
      // POST credentials to auth API
      const result = await window.api.post('/auth/login', {
        email:    emailInput.value.trim(),
        password: passInput.value,
      });

      // Store token and user data
      window.Storage.setToken(result.token);
      window.Storage.setUser(result.user);

      window.Toast.success(`Welcome back, ${result.user.name.split(' ')[0]}!`);

      // Redirect to dashboard or saved URL
      setTimeout(() => window.Auth.redirectAfterLogin(), 700);

    } catch (err) {
      // Show error message
      loginErr.textContent = err.message || 'Invalid email or password.';
      loginErr.classList.remove('hidden');
    } finally {
      // Reset button state
      spinner.classList.add('hidden');
      btnText.textContent = 'Sign In';
      submitBtn.disabled = false;
    }
  });
});
