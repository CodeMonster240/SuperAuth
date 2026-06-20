(function () {
  const root = document.documentElement;
  const saved = localStorage.getItem('superauth-theme');
  if (saved) root.setAttribute('data-theme', saved);

  function applyIcon(theme) {
    const icon = document.getElementById('themeIcon');
    const iconSide = document.getElementById('themeIconSide');
    const cls = theme === 'dark' ? 'fa-moon' : 'fa-sun';
    if (icon) icon.className = `fas ${cls}`;
    if (iconSide) iconSide.className = `fas ${cls}`;
  }

  function toggle() {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.classList.add('theme-transition');
    root.setAttribute('data-theme', next);
    localStorage.setItem('superauth-theme', next);
    applyIcon(next);
    setTimeout(() => root.classList.remove('theme-transition'), 260);
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyIcon(root.getAttribute('data-theme') || 'dark');
    const a = document.getElementById('themeToggle');
    const b = document.getElementById('themeToggleSide');
    if (a) a.addEventListener('click', toggle);
    if (b) b.addEventListener('click', toggle);
  });
})();
