const phrases = [
  "Enhance productivity.",
  "Facilitate creativity.",
  "Simplify interaction."
];

const typewriter = document.getElementById("typewriter");

let phraseIndex = 0;
let charIndex = 0;
let typing = true;

function typeEffect() {
  const currentPhrase = phrases[phraseIndex];

  if (typing) {
    if (charIndex <= currentPhrase.length) {
      typewriter.textContent = currentPhrase.substring(0, charIndex++);
      setTimeout(typeEffect, 80);
    } else {
      typing = false;
      setTimeout(typeEffect, 1500); // pause before deleting
    }
  } else {
    if (charIndex > 0) {
      typewriter.textContent = currentPhrase.substring(0, --charIndex);
      setTimeout(typeEffect, 40);
    } else {
      typing = true;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      setTimeout(typeEffect, 500); // pause before typing next
    }
  }
}

typeEffect();

// Theme toggle
function toggleTheme() {
  const body = document.body;
  const currentTheme = body.classList.contains("light-mode") ? "light" : "dark";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  body.classList.toggle("light-mode");
  localStorage.setItem("theme", newTheme);
}

// Load saved theme
window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
  }
});
