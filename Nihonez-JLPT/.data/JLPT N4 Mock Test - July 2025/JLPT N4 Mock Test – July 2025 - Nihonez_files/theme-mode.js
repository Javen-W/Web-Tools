jQuery(document).ready(function ($) {
  const themeToggle = $("#theme-toggle");
  const sunIcon = themeToggle.find(".sun-icon");
  const moonIcon = themeToggle.find(".moon-icon");

  function toggleTheme(isDark) {
    if (isDark) {
      $("html").attr("data-theme", "dark");
      localStorage.setItem("theme", "dark");
      sunIcon.hide();
      moonIcon.show();
    } else {
      $("html").removeAttr("data-theme");
      localStorage.setItem("theme", "light");
      moonIcon.hide();
      sunIcon.show();
    }
  }

  function setTheme() {
    const currentTheme = localStorage.getItem("theme");
    toggleTheme(currentTheme === "dark");
  }

  themeToggle.on("click", function () {
    const currentTheme = localStorage.getItem("theme");
    toggleTheme(currentTheme !== "dark");
  });

  setTheme();

  // Expose the toggle function globally
  window.jldmToggleTheme = toggleTheme;
});
