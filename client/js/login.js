(function () {
  const form = document.getElementById("loginForm");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const formError = document.getElementById("formError");

  function showError(msg) {
    if (!formError) return;
    formError.textContent = msg || "Please fill in all fields correctly.";
    formError.classList.remove("hidden");
  }
  function clearError() {
    formError?.classList.add("hidden");
  }

  form?.addEventListener("submit", function (e) {
    e.preventDefault();
    clearError();

    const name = (nameInput?.value || "").trim();
    const email = (emailInput?.value || "").trim();
    const password = (passwordInput?.value || "");

    const emailOk = /@(?:g\.coastal\.edu|coastal\.edu)$/i.test(email);

    if (!name || !email || !password || !emailOk) {
      showError("Enter a name, a CCU email (@g.coastal.edu or @coastal.edu), and a password.");
      return;
    }

    try {
      sessionStorage.setItem("mc_userName", name);
      sessionStorage.setItem("mc_email", email);
      sessionStorage.setItem("mc_isLoggedIn", "true");
    } catch (_) {
      // if sessionStorage isnt available, we still continue to the dashboard
    }

    window.location.href = "./dashboard.html";
  });
})();