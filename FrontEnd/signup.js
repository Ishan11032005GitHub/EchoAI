// ======================
// 🎨 Theme Toggle
// ======================
const toggleTheme = () => {
  const body = document.body;
  const isLight = body.classList.toggle("light-mode");
  body.classList.toggle("dark-mode", !isLight);
  localStorage.setItem("theme", isLight ? "light" : "dark");
};

document.getElementById("toggleTheme")?.addEventListener("click", toggleTheme);

const applySavedTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
    document.body.classList.remove("dark-mode");
  }
};

applySavedTheme();

// ======================
// ✅ Handle OAuth Token (Redirected with ?token=...)
// ======================
window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");
  if (token) {
    fetch("https://echoai-backend-development.up.railway.app/api/auth/verify", {
  method: "GET",
  headers: { Authorization: `Bearer ${token}` },
  credentials: "include",
})
  .then(res => res.json())
  .then(data => {
    localStorage.setItem("currentUser", JSON.stringify(data.user));
    window.location.href = "home.html";
  })
  .catch(err => {
    console.error("❌ Token verification failed after Google login:", err);
    localStorage.removeItem("authToken");
    window.location.href = "signin.html?error=oauth_failed";
  });
    localStorage.setItem("authToken", token);
    // Optional: Fetch user info here or just redirect
    window.location.href = "home.html";
  }
});

// ======================
// 📝 Signup Form Submission
// ======================
document.getElementById("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById("submitBtn");
  const submitText = document.getElementById("submitText");
  const submitSpinner = document.getElementById("submitSpinner");

  submitText.textContent = "Creating Account...";
  submitSpinner.classList.remove("hidden");
  submitBtn.disabled = true;

  const name = document.getElementById("nameInput").value.trim();
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  const confirmPassword = document.getElementById("confirmPasswordInput").value;
  const agree = document.getElementById("agreeCheckbox").checked;
  const file = document.getElementById("profilePictureInput")?.files?.[0];

  const formData = { name, email, password, confirmPassword, agree };

  if (!validateForm(formData)) {
    resetFormState(submitBtn, submitText, submitSpinner);
    return;
  }

  try {
    const profilePicture = file ? await convertToBase64(file) : null;

    const response = await fetch("https://echoai-backend-development.up.railway.app/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, profilePicture }),
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Signup failed");

    localStorage.setItem("authToken", result.token);

    // ✅ Verify token before redirect
    fetch("https://echoai-backend-development.up.railway.app/api/auth/verify", {
      method: "GET",
      headers: { Authorization: `Bearer ${result.token}` },
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid token");
        return res.json();
      })
      .then((data) => {
        localStorage.setItem("currentUser", JSON.stringify(data.user));
        window.location.href = "home.html";
      })
      .catch((err) => {
        console.error("❌ Signup token verification failed:", err);
        localStorage.removeItem("authToken");
        showError("Signup succeeded but login failed. Please sign in again.");
        resetFormState(submitBtn, submitText, submitSpinner);
      });

  } catch (error) {
    showError(error.message || "Signup failed");
    resetFormState(submitBtn, submitText, submitSpinner);
  }
});

// ======================
// 🔧 Helper Functions
// ======================
const validateForm = ({ name, email, password, confirmPassword, agree }) => {
  if (!name || !email || !password || !confirmPassword) {
    showError("Please fill in all fields");
    return false;
  }
  if (password !== confirmPassword) {
    showError("Passwords do not match");
    return false;
  }
  if (password.length < 8) {
    showError("Password must be at least 8 characters");
    return false;
  }
  if (!agree) {
    showError("You must agree to the terms");
    return false;
  }
  return true;
};

const convertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const showError = (message) => {
  const errorDisplay = document.getElementById("errorDisplay");
  errorDisplay.textContent = message;
  errorDisplay.classList.remove("hidden");
  setTimeout(() => errorDisplay.classList.add("hidden"), 5000);
};

const resetFormState = (submitBtn, submitText, submitSpinner) => {
  submitText.textContent = "Sign Up";
  submitSpinner.classList.add("hidden");
  submitBtn.disabled = false;
};
