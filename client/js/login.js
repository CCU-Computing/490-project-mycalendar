import { api } from "./apiClient.js";

const form = document.getElementById("loginForm");
const nameEl = document.getElementById("name");
const emailEl = document.getElementById("email");
const pwdEl = document.getElementById("password");
const errEl = document.getElementById("formError");

// (Optional) relabel the password field to make it clear it's the token
const pwdLabel = document.querySelector('label[for="password"]');
if (pwdLabel) pwdLabel.textContent = "Moodle Token (hash)";
if (pwdEl) {
  pwdEl.placeholder = "Paste your Moodle token (hash)";
  pwdEl.type = "text"; // show it plainly during dev; change back to "password" if you prefer
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl?.classList.add("hidden");
  errEl.textContent = "";

  const name = (nameEl?.value || "").trim() || "Student";
  const email = (emailEl?.value || "").trim(); // not used by backend right now
  const token = (pwdEl?.value || "").trim();   // <-- this is the token (hash)

  if (!token) {
    errEl.textContent = "Please paste your Moodle token (hash) into the field.";
    errEl.classList.remove("hidden");
    return;
  }

  try {
    // Sends { name, token } to your Express /api/login; server stores the token in session
    await api.login(name, token);

    // For your header greeting etc.
    sessionStorage.setItem("mc_userName", name);
    sessionStorage.setItem("mc_email", email);

    // Go to dashboard
    window.location.href = "/pages/dashboard.html";
  } catch (err) {
    errEl.textContent = "Login failed: " + (err?.message || "Unknown error");
    errEl.classList.remove("hidden");
  }
});