(function () {
  window.SuperAuthDevPages = window.SuperAuthDevPages || {};

  window.SuperAuthDevPages.overview = {
    async mount({ root, go }) {
      root.querySelector('[data-jump="apps"]')?.addEventListener('click', () => go('apps'));
    }
  };
})();
