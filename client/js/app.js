(function () {
  // render a tiny react banner into #root
  const e = React.createElement;
  const DemoBanner = () =>
    e(
      "div",
      { className: "bg-amber-50 border-b border-amber-200" },
      e(
        "div",
        { className: "mx-auto max-w-6xl px-4 py-2 text-sm text-amber-800 flex items-center gap-2" },
        e("span", null, "⚠️"),
        e("span", null, "Demo build — placeholder landing page. Not connected to Moodle yet.")
      )
    );

  const root = document.getElementById("root");
  if (root) {
    const reactRoot = ReactDOM.createRoot(root);
    reactRoot.render(e(DemoBanner));
  }

  function handleLoginClick() {
    window.location.href = "./pages/login.html";
  }

  const mainBtn = document.getElementById("loginBtn");
  const heroBtn = document.getElementById("loginBtnHero");
  if (mainBtn) mainBtn.addEventListener("click", handleLoginClick);
  if (heroBtn) heroBtn.addEventListener("click", handleLoginClick);

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
