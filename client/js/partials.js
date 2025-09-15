async function inject(el) {
  const url = el.getAttribute("data-partial");
  if (!url) return;
  try {
    const res = await fetch(url, { cache: "no-store" });
    el.innerHTML = await res.text();
  } catch (e) {
    el.innerHTML = `<div class="bg-red-50 text-red-700 text-sm p-3 rounded">Failed to load partial: ${url}</div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-partial]").forEach(inject);
});
