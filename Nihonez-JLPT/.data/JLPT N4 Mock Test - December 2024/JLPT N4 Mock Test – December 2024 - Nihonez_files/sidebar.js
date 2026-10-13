jQuery(document).ready(function ($) {
  $(".menu-trigger").click(function () {
    // $("body").toggleClass("sidebar-hidden");
    $("body").toggleClass("sidebar-active");
  });
});

// Toggle
document.addEventListener("DOMContentLoaded", function () {
  const parentLinks = document.querySelectorAll(".sidebar-link-parent");

  parentLinks.forEach((link) => {
    // link.addEventListener("click", function (e) {
    //   if (e.target.tagName !== "A" && e.target.tagName !== "SPAN") {
    //     e.preventDefault();
    //     this.classList.toggle("active");

    //     // Toggle the rotation of the SVG icon
    //     const toggleButton = this.querySelector(".toggle-button");
    //     if (toggleButton) {
    //       if (this.classList.contains("active")) {
    //         toggleButton.querySelector("svg").style.transform = "rotate(0deg)";
    //       } else {
    //         toggleButton.querySelector("svg").style.transform =
    //           "rotate(-90deg)";
    //       }
    //     }

    //     // Toggle the submenu display
    //     const submenu = this.nextElementSibling;
    //     if (submenu && submenu.classList.contains("sidebar-submenu")) {
    //       if (this.classList.contains("active")) {
    //         submenu.style.display = "block";
    //       } else {
    //         submenu.style.display = "none";
    //       }
    //     }
    //   }
    // });

    link.addEventListener("click", function (e) {
      if (e.target.tagName !== "A" && e.target.tagName !== "SPAN") {
        e.preventDefault();

        // Check current state BEFORE toggling
        const isCurrentlyActive = this.classList.contains("active");

        this.classList.toggle("active");

        const toggleButton = this.querySelector(".toggle-button");
        if (toggleButton) {
          toggleButton.querySelector("svg").style.transform = isCurrentlyActive
            ? "rotate(-90deg)"
            : "rotate(0deg)";
        }

        const submenu = this.nextElementSibling;
        if (submenu && submenu.classList.contains("sidebar-submenu")) {
          submenu.style.display = isCurrentlyActive ? "none" : "block";
        }
      }
    });
  });
});
