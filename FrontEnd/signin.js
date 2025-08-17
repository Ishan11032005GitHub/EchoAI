document.addEventListener('DOMContentLoaded', function () {
  // ======================
  // 🌗 Theme Toggle
  // ======================
  const toggleThemeBtn = document.getElementById('toggleTheme');
  const body = document.body;

  function initTheme() {
    const savedTheme =
      localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    body.classList.add(savedTheme + '-mode');
  }
  initTheme();

  toggleThemeBtn.addEventListener('click', function () {
    body.classList.toggle('dark-mode');
    body.classList.toggle('light-mode');
    localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
  });

  // ======================
  // 🧠 Handle OAuth Redirect Token (Google/Facebook)
  // ======================
    const token = new URL(window.location.href).searchParams.get('token');

  if (token) {
    document.body.classList.add('loading');
    localStorage.setItem('authToken', token);

    (async () => {
      try {
        const verifyResponse = await fetch('https://echoai-backend-development.up.railway.app/api/auth/verify', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!verifyResponse.ok) {
          throw new Error('Token verification failed');
        }

        const userData = await verifyResponse.json(); // ✅ Await it
        localStorage.setItem('currentUser', JSON.stringify(userData.user));

        window.location.href = 'home.html';
      } catch (error) {
        console.error('OAuth error:', error);
        localStorage.removeItem('authToken');
        alert('Google login failed. Please try again.');
        document.body.classList.remove('loading');
      }
    })();
  }

  // ======================
  // 🧾 DOM Elements
  // ======================
  const signinForm = document.getElementById('signinForm');
  const loadingScreen = document.getElementById('loadingScreen');

  // ======================
  // 🔐 Login Form Handler
  // ======================
  signinForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;

    if (!validateForm(email, password)) return;

    loadingScreen.style.display = 'block';
    document.getElementById('SUBMITFORM').disabled = true;

    try {
      const response = await fetch('https://echoai-backend-development.up.railway.app/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Sign in failed');

      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));

      window.location.href = 'home.html';
    } catch (error) {
      console.error('Sign in error:', error);
      alert(error.message);
    } finally {
      loadingScreen.style.display = 'none';
      document.getElementById('SUBMITFORM').disabled = false;
    }
  });

  // ======================
  // 🔍 Form Validation
  // ======================
  function validateForm(email, password) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address');
      return false;
    }

    if (password.length < 8) {
      alert('Password must be at least 8 characters long');
      return false;
    }

    return true;
  }
});
