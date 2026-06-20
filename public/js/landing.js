(function () {
  function animateStats() {
    if (!window.SuperAuthNumberFlow) return;
    window.SuperAuthNumberFlow.enhance(document, { delay: 1000 });
  }

  function revealOnScroll() {
    const els = document.querySelectorAll('.animate-on-scroll');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    els.forEach((el) => obs.observe(el));
  }

  document.addEventListener('DOMContentLoaded', function () {
    animateStats();
    revealOnScroll();
  });
})();
