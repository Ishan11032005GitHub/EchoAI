document.addEventListener("DOMContentLoaded", async () => {
  const generateBtn = document.getElementById("generateImageBtn");
  const imagePrompt = document.getElementById("imagePrompt");
  const imageResultContainer = document.getElementById("imageResultContainer");
  const toggleThemeBtn = document.getElementById("toggleTheme");
  const body = document.body;

  const currentUserId = localStorage.getItem("currentUserId");
  const currentUsername = localStorage.getItem("currentUsername");

  if (!currentUserId || !currentUsername) {
    alert("Session expired. Please sign in again.");
    window.location.href = "signin.html";
    return;
  }

  const localImageKey = `imageHistory_${currentUserId}`;
  const HF_API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2";
  const HF_API_KEY = "Bearer YOUR_HUGGINGFACE_API_KEY_HERE"; // Replace securely
  const MAX_IMAGES = 50;

  toggleThemeBtn?.addEventListener("click", () => {
    const isLight = body.classList.toggle("light-mode");
    body.classList.toggle("dark-mode", !isLight);
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    body.classList.add("light-mode");
    body.classList.remove("dark-mode");
  } else {
    body.classList.add("dark-mode");
    body.classList.remove("light-mode");
  }

  function createImageBox(base64, promptText) {
    const wrapper = document.createElement("div");
    wrapper.className = "image-wrapper";

    const img = document.createElement("img");
    img.src = `data:image/png;base64,${base64}`;
    img.alt = promptText;
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

  async function loadImageHistory() {
    const localHistory = JSON.parse(localStorage.getItem(localImageKey) || "[]");
    if (localHistory.length) displayImages(localHistory);

    try {
      const res = await fetch(`https://echoai-production-56c9.up.railway.app/api/imagehistory/${currentUserId}`);
      if (!res.ok) throw new Error("Failed to load image history");
      const serverData = await res.json();
      const serverHistory = serverData.images || [];
      const combined = mergeHistories(localHistory, serverHistory);
      localStorage.setItem(localImageKey, JSON.stringify(combined));
      displayImages(combined.reverse());
    } catch (err) {
      console.error("Image history error:", err);
    }
  }

  function mergeHistories(local, server) {
    const combined = [...local, ...server];
    return combined.filter((img, index, self) =>
      index === self.findIndex(i => i.timestamp === img.timestamp && i.prompt === img.prompt)
    ).slice(-MAX_IMAGES);
  }

  function displayImages(images) {
    imageResultContainer.innerHTML = "";
    images.forEach(({ prompt, imageBase64 }) => {
      const box = createImageBox(imageBase64, prompt);
      imageResultContainer.appendChild(box);
    });
    imageResultContainer.scrollTop = imageResultContainer.scrollHeight;
  }

  async function saveImageHistory(imageData) {
    const local = JSON.parse(localStorage.getItem(localImageKey) || "[]");
    const updated = [...local, imageData].slice(-MAX_IMAGES);
    localStorage.setItem(localImageKey, JSON.stringify(updated));

    try {
      await fetch("https://echoai-production-56c9.up.railway.app/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(imageData)
      });
    } catch (err) {
      console.error("Save to server failed:", err);
    }
  }

  async function generateImage(prompt) {
    const res = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        "Authorization": HF_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: prompt })
    });

    if (!res.ok) throw new Error("Image generation failed");
    const blob = await res.blob();
    const base64 = await blobToBase64(blob);
    return base64;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  generateBtn?.addEventListener("click", async () => {
    const promptText = imagePrompt.value.trim();
    if (!promptText) return alert("Please enter an image prompt.");

    generateBtn.disabled = true;
    generateBtn.innerText = "Generating...";

    const loadingMsg = createImageBox("", "Generating...");
    imageResultContainer.appendChild(loadingMsg);

    try {
      const base64 = await generateImage(promptText);
      const imageData = {
        userId: currentUserId,
        prompt: promptText,
        imageBase64: base64,
        timestamp: new Date().toISOString()
      };

      imageResultContainer.removeChild(loadingMsg);
      const imageBox = createImageBox(base64, promptText);
      imageResultContainer.appendChild(imageBox);
      imageResultContainer.scrollTop = imageResultContainer.scrollHeight;

      await saveImageHistory(imageData);
    } catch (err) {
      console.error("Image error:", err);
      loadingMsg.innerHTML = `<div class='error'>${err.message}</div>`;
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerText = "Generate Image";
    }
  });

  loadImageHistory();
});
