(function () {
    var banner = document.getElementById('lunar-new-year-banner');
    if (banner) {
        banner.querySelector('.jlpt-banner-close').addEventListener('click', function () {
            banner.style.display = 'none';
        });
    }

    var devBanner = document.getElementById('dev-notice-banner');
    if (devBanner) {
        devBanner.querySelector('.dev-banner-close').addEventListener('click', function () {
            devBanner.style.display = 'none';
        });
    }
})();
