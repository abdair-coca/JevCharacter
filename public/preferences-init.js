// Blocking head script: preferences are applied before styles and React paint.
(() => {
  const read = (key) => {
    try { return JSON.parse(localStorage.getItem(key) ?? "null"); }
    catch { return null; }
  };
  const savedTheme = read("jevling.theme");
  const savedLanguage = read("jevling.language");
  const themePreference = savedTheme === "light" || savedTheme === "dark" ? savedTheme : "system";
  const theme = themePreference === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : themePreference;
  const browserLanguage = navigator.language.toLowerCase().split("-")[0];
  const language = savedLanguage === "es" || savedLanguage === "en"
    ? savedLanguage
    : (browserLanguage === "en" ? "en" : "es");
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = themePreference;
  document.documentElement.lang = language;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", themeColor.dataset[theme]);
})();
