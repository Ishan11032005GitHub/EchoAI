document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
const tokenFromURL = params.get("token");
const userFromURL = params.get("user");

if (tokenFromURL && userFromURL) {
  localStorage.setItem("authToken", tokenFromURL);
  localStorage.setItem("currentUser", decodeURIComponent(userFromURL)); // Keep as is
  } 
  
  const authToken = localStorage.getItem("authToken");
let currentUser;

try {
  currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

  // 🔽 PLACE THESE LINES HERE ✅
  if (!currentUser.username && currentUser.name) {
    currentUser.username = currentUser.name;
  }
  if (!currentUser.id) {
    currentUser.id = currentUser._id || currentUser.userId || null;
  }

  // 🔽 Final auth check
  if (!authToken || !currentUser.id) {
    throw new Error("Missing token or user ID");
  }
} catch (err) {
  console.warn("⛔ Invalid session. Redirecting...", err.message);
  return (window.location.href = "signin.html");
}

  const chatContainer = document.querySelector(".chat-container");
  const promptInput = document.getElementById("prompt");
  const fileInput = document.getElementById("fileInput");
  const submitBtn = document.getElementById("submitbtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const toggleThemeBtn = document.getElementById("toggleTheme");
  const clearHistoryBtn = document.getElementById("clearHistory");
  const voiceSearchBtn = document.getElementById("voiceSearch");
  const filePreviewContainer = document.getElementById("filePreviewContainer");

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.classList.remove("dark-mode");
  }

  toggleThemeBtn?.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem(
      "theme",
      document.body.classList.contains("dark-mode") ? "dark" : "light"
    );
  });

  addChatMessage("ai", `Hello ${currentUser.username || "there"}! How can I help you today?`);
  const chatHistory = [
    { role: "system", content: "You are a helpful assistant." }
  ];

  submitBtn.addEventListener("click", handleSubmit);
  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  });

  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    window.location.href = "signin.html";
  });

  clearHistoryBtn?.addEventListener("click", clearChatHistory);
  voiceSearchBtn?.addEventListener("click", initVoiceSearch);

  fileInput?.addEventListener("change", () => {
  const files = Array.from(fileInput.files || []);
  const fileTagList = document.getElementById("fileTagList");
  fileTagList.innerHTML = ""; // Clear previous previews

  files.forEach((file) => {
    const tag = document.createElement("span");
    tag.className = "file-tag";
    tag.setAttribute("contenteditable", "false");
    tag.innerHTML = `📎 ${file.name} <span class="remove-file-btn" contenteditable="false">❌</span>`;

    tag.querySelector(".remove-file-btn").addEventListener("click", () => {
      tag.remove();

      const remaining = Array.from(fileInput.files).filter(f => f.name !== file.name);
      const dataTransfer = new DataTransfer();
      remaining.forEach(f => dataTransfer.items.add(f));
      fileInput.files = dataTransfer.files;

      fileInput.dispatchEvent(new Event("change"));
    });

    fileTagList.appendChild(tag);
  });
});

  await fetchChatHistory();

  async function fetchChatHistory() {
    try {
      const res = await fetch("https://echoai-backend-development.up.railway.app/chathistory", {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await res.json();
      if (!res.ok || !data.chats) throw new Error(data.message || "No chat history found");

      data.chats.forEach(({ prompt, response, fileUrl }) => {
        if (prompt) addChatMessage("user", prompt);
        if (fileUrl) {
          addChatMessage("user", `📎 <a href="${fileUrl}" target="_blank">Attached File</a>`);
        }
        addChatMessage("ai", response);

        if (prompt) chatHistory.push({ role: "user", content: prompt });
        chatHistory.push({ role: "assistant", content: response });
      });
    } catch (err) {
      console.error("Chat history error:", err.message);
    }
  }

  async function handleSubmit() {
  const prompt = promptInput.innerText.trim(); // Use innerText for contenteditable div
  const file = fileInput?.files?.[0];
  let fileContent = "";

  if (!prompt && !file) return;

  // Display user message in chat
  if (prompt) addChatMessage("user", prompt);
  if (file) addChatMessage("user", `📎 <i>${file.name}</i>`);

  // Clear input
  promptInput.innerHTML = "";                      // Clear contenteditable div
  fileInput.value = "";                            // Reset file input
  promptInput.querySelectorAll(".file-tag").forEach(tag => tag.remove()); // Remove file tags if any

  const aiMsgElement = addChatMessage("ai", "");
  aiMsgElement.classList.add("thinking");

  try {
    if (file) {
      fileContent = await readFileContent(file);
    }

    const fullPrompt = prompt + (fileContent ? `\n\n[Attached File Content]:\n${fileContent}` : "");
    const aiResponse = await getGeminiResponse(fullPrompt);
    await typeOutText(aiMsgElement, processMarkdown(aiResponse));
    await saveChatWithFile(prompt || "File-only", aiResponse, Array.from(fileInput.files || []));
  } catch (error) {
    aiMsgElement.innerHTML = `⚠️ Error: ${error.message}<br>Try again in a moment.`;
  } finally {
    aiMsgElement.classList.remove("thinking");
    fileInput.value = "";
  }
}

  async function getGeminiResponse(prompt) {
    const authToken = localStorage.getItem("authToken");

    if (!authToken) {
      throw new Error("No auth credentials found");
    }
  const response = await fetch("https://echoai-backend-development.up.railway.app/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("authToken")}`
    },
    body: JSON.stringify({ prompt })  // 🔥 Correct key and value
  });

  const data = await response.json();
  console.log("Backend AI Response:", data);

  if (!response.ok) {
    throw new Error(data?.error || "AI request failed");
  }

  chatHistory.push({ role: "assistant", content: data.response });
  return data.response;
}

  async function saveChatWithFile(prompt, response, files = []) {
  try {
    const url = `https://echoai-backend-development.up.railway.app/chatWithFile`;
    const formData = new FormData();

    formData.append("prompt", prompt);
    formData.append("response", response);


    files.forEach(file => formData.append("files", file));

    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });
  } catch (error) {
    console.error("Failed to save chat:", error);
  }
}

  async function clearChatHistory() {
    if (!confirm("Clear all chat history?")) return;

    try {
      const res = await fetch("https://echoai-backend-development.up.railway.app/chatDelete", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.ok) {
        chatContainer.innerHTML = "";
        chatHistory.splice(1);
      }
    } catch (error) {
      alert("Failed to clear history");
    }
  }

  let recognition;
  let isListening = false;

  function initVoiceSearch() {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Voice search not supported in your browser");
      return;
    }

    if (!recognition) {
      recognition = new webkitSpeechRecognition();
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        promptInput.innerText = transcript;
        stopRecognition();
      };

      recognition.onerror = () => stopRecognition();
      recognition.onend = () => stopRecognition();
    }

    if (!isListening) {
      recognition.start();
      isListening = true;
      voiceSearchBtn.innerText = "🔴 I'm Listening";
    } else {
      recognition.stop();
      stopRecognition();
    }
  }

  function stopRecognition() {
    isListening = false;
    voiceSearchBtn.innerText = "🎤 Voice Search";
  }

  function addChatMessage(role, text) {
    const message = document.createElement("div");
    message.className = `chat-message ${role}`;
    message.innerHTML = processMarkdown(text);
    chatContainer.appendChild(message);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return message;
  }

  function processMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
      .replace(/`(.*?)`/g, "<code>$1</code>");
  }

  async function typeOutText(element, text, delay = 15) {
  const sendBtn = document.getElementById("submitbtn");
  const fileInput = document.getElementById("fileInput");
  const voiceSearch = document.getElementById("voiceSearch");

  // Disable controls
  sendBtn.disabled = true;
  fileInput.disabled = true;
  voiceSearch.disabled = true;
  sendBtn.classList.add("disabled");
  voiceSearch.classList.add("disabled");

  element.innerHTML = "";

  for (let char of text) {
    element.innerHTML += char;
    await new Promise((res) => setTimeout(res, delay));
  }

  // Re-enable controls
  sendBtn.disabled = false;
  fileInput.disabled = false;
  voiceSearch.disabled = false;
  sendBtn.classList.remove("disabled");
  voiceSearch.classList.remove("disabled");
}

  function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    // ✅ DOCX
    if (fileName.endsWith(".docx")) {
      reader.onload = async () => {
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: reader.result });
          resolve(result.value);
        } catch (err) {
          reject("Failed to read DOCX: " + err.message);
        }
      };
      reader.onerror = () => reject("Error reading DOCX file.");
      reader.readAsArrayBuffer(file);

    // ✅ PDF
    } else if (file.type === "application/pdf") {
      reader.onload = async () => {
        try {
          const typedarray = new Uint8Array(reader.result);
          const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
          let text = "";

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str).join(" ");
            text += strings + "\n";
          }

          resolve(text);
        } catch (err) {
          reject("Failed to read PDF: " + err.message);
        }
      };
      reader.onerror = () => reject("Error reading PDF.");
      reader.readAsArrayBuffer(file);

    // ✅ XLSX, XLS
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      reader.onload = () => {
        try {
          const data = new Uint8Array(reader.result);
          const workbook = XLSX.read(data, { type: "array" });
          let text = "";

          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            text += `Sheet: ${sheetName}\n`;
            text += XLSX.utils.sheet_to_csv(sheet) + "\n";
          });

          resolve(text);
        } catch (err) {
          reject("Failed to read Excel file: " + err.message);
        }
      };
      reader.onerror = () => reject("Error reading Excel file.");
      reader.readAsArrayBuffer(file);

    // ✅ Plain text (txt, csv, json, xml)
    } else if (
      file.type.startsWith("text/") ||
      fileName.endsWith(".csv") ||
      fileName.endsWith(".json") ||
      fileName.endsWith(".xml")
    ) {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject("Error reading text file.");
      reader.readAsText(file);

    // ⚠️ Unsupported (e.g., PPTX or binary)
    } else {
      reject("Unsupported file type for reading: " + file.name);
    }
  });
}
});
