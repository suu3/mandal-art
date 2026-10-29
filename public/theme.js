// Run before the stylesheet/app to preserve the saved theme without inline JS.
try {
  document.documentElement.dataset.theme =
    localStorage.getItem("madalart-theme") === "dark" ? "dark" : "light";
} catch {}
