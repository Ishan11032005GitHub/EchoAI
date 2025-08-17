document.addEventListener("DOMContentLoaded", async () => {
  const generateBtn = document.getElementById("generateImageBtn");
  const imagePrompt = document.getElementById("imagePrompt");
  const imageResultContainer = document.getElementById("imageResultContainer");
  const toggleThemeBtn = document.getElementById("toggleTheme");
  const backBtn = document.getElementById("backBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const clearHistoryBtn = document.getElementById("clearHistory");
  const body = document.body;

  const BACKEND_URL = 'https://echoai-backend-development.up.railway.app';

  // ✅ Theme Initialization
  const savedTheme = localStorage.getItem("theme") || "dark";
  body.classList.remove("light-mode", "dark-mode");
  body.classList.add(savedTheme + "-mode");

  // ✅ Theme Toggle Button Logic
  toggleThemeBtn?.addEventListener("click", () => {
    const isCurrentlyLight = body.classList.contains("light-mode");
    body.classList.remove("light-mode", "dark-mode");

    if (isCurrentlyLight) {
      body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      body.classList.add("light-mode");
      localStorage.setItem("theme", "light");
    }
  });

  // ✅ Back Button
  backBtn?.addEventListener("click", () => {
    window.location.href = "home.html";
  });

  // ✅ Auth Check
  const token = localStorage.getItem("authToken");
  let currentUser = {};

  try {
    currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

    if (!currentUser.username && currentUser.name) {
      currentUser.username = currentUser.name;
    }

    if (!currentUser.id) {
      currentUser.id = currentUser._id || currentUser.userId || null;
    }

    if (!token || !currentUser.id) {
      throw new Error("Missing authentication");
    }
  } catch (err) {
    alert("Session expired. Please sign in again.");
    window.location.href = "signin.html";
    return;
  }

  const localImageKey = `imageHistory_${currentUser.id}`;

  // ✅ Logout
  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    window.location.href = "signin.html";
  });

  // ✅ Clear History
  clearHistoryBtn?.addEventListener("click", async () => {
    if (!confirm("Clear all generated images?")) return;

    try {
      localStorage.removeItem(localImageKey);
      imageResultContainer.innerHTML = "";

      await fetch(`${BACKEND_URL}/api/imageDelete`, {
  method: "DELETE",
  headers: {
    Authorization: `Bearer ${token}`
  }
});
    } catch (err) {
      console.error("❌ Failed to clear server history", err);
    }
  });

  function sanitizeText(text) {
    return text.replace(/[&<>"']/g, match =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[match]
    );
  }

  function createImageBox(base64, promptText) {
    const wrapper = document.createElement("div");
    wrapper.className = "image-wrapper";

    const img = document.createElement("img");
    img.src = `data:image/png;base64,${base64}`;
    img.alt = sanitizeText(promptText);
    img.className = "generated-image";

    const downloadBtn = document.createElement("button");
    downloadBtn.innerText = "⬇️ Download";
    downloadBtn.className = "download-btn";
    downloadBtn.onclick = () => {
      const a = document.createElement("a");
      a.href = img.src;
      a.download = "generated-image.png";
      a.click();
    };

    wrapper.appendChild(img);
    wrapper.appendChild(downloadBtn);
    return wrapper;
  }

  function displayImages(images) {
    imageResultContainer.innerHTML = "";
    images.forEach(({ prompt, imageBase64 }) => {
      const box = createImageBox(imageBase64, prompt);
      imageResultContainer.appendChild(box);
    });
    imageResultContainer.scrollTop = imageResultContainer.scrollHeight;
  }

  function mergeHistories(local, server) {
    const combined = [...local, ...server];
    return combined.filter((img, index, self) =>
      index === self.findIndex(i =>
        i.prompt === img.prompt && i.imageBase64 === img.imageBase64
      )
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  async function loadImageHistory() {
    let localHistory = [];
    try {
      localHistory = JSON.parse(localStorage.getItem(localImageKey)) || [];
    } catch (err) {
      console.error("❌ Local history parse error:", err);
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/imagehistory`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error("Server history fetch failed");

      const data = await res.json();
      const serverHistory = data.images || [];

      const merged = mergeHistories(localHistory, serverHistory);
      localStorage.setItem(localImageKey, JSON.stringify(merged));
      displayImages(merged.reverse());
    } catch (err) {
      console.error("❌ Image history error:", err);
      displayImages(localHistory.reverse());
    }
  }

  async function saveImageHistory(imageData) {
    const local = JSON.parse(localStorage.getItem(localImageKey) || "[]");
    const updated = [...local, imageData];
    localStorage.setItem(localImageKey, JSON.stringify(updated));
  }

  async function saveImageToServer(imageData) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(imageData)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error || "Failed to save image to server.");
      }
    } catch (err) {
      console.error("❌ Server save error:", err);
    }
  }

  async function generateImage(prompt) {
    const res = await fetch(`${BACKEND_URL}/api/image/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();

    if (!res.ok || !data.imageBase64) {
      const error = data?.error || "Image generation failed.";
      throw new Error(error);
    }

    return { base64: data.imageBase64, prompt };
  }

  generateBtn?.addEventListener("click", async () => {
    const prompt = imagePrompt.value.trim();
    if (!prompt) return alert("Please enter an image prompt.");

    generateBtn.disabled = true;
    generateBtn.innerText = "Generating...";

    const spinner = document.createElement("div");
    spinner.className = "spinner";
    spinner.innerText = "⏳ Generating Image...";
    imageResultContainer.appendChild(spinner);

    try {
      const { base64, prompt: usedPrompt } = await generateImage(prompt);

      const imageData = {
        userId: currentUser.id,
        prompt: usedPrompt,
        imageBase64: base64,
        timestamp: new Date().toISOString()
      };

      const imageBox = createImageBox(base64, usedPrompt);
      imageResultContainer.removeChild(spinner);
      imageResultContainer.appendChild(imageBox);
      imageResultContainer.scrollTop = imageResultContainer.scrollHeight;

      await saveImageHistory(imageData);
      // await saveImageToServer(imageData);

    } catch (err) {
      console.error("❌ Image generation error:", err);
      imageResultContainer.removeChild(spinner);
      alert(err.message || "Something went wrong.");
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerText = "Generate Image";
    }
  });

  await loadImageHistory();
});
