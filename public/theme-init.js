// Apply the persisted theme before first paint to avoid a flash (PLAN.md §18).
// A file, not an inline script, so the Content-Security-Policy can stay "script-src 'self'".
(function () {
  try {
    var stored = JSON.parse(localStorage.getItem("tenno.device-preferences") || "null");
    var theme = (stored && stored.state && stored.state.theme) || "system";
    var dark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#17212B" : "#FFFFFF");
  } catch (e) {}
})();
