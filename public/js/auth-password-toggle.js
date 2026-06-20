(function () {
  function bindToggle(button) {
    const targetId = button.getAttribute('data-toggle-password');
    if (!targetId) return;

    const input = document.getElementById(targetId);
    if (!input) return;

    const icon = button.querySelector('i');

    function setVisible(visible) {
      input.type = visible ? 'text' : 'password';
      button.classList.toggle('active', visible);
      button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
      button.setAttribute('title', visible ? 'Hide password' : 'Show password');
      if (icon) {
        icon.classList.toggle('fa-eye', !visible);
        icon.classList.toggle('fa-eye-slash', visible);
      }
    }

    setVisible(false);
    button.addEventListener('click', function () {
      setVisible(input.type === 'password');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.password-toggle').forEach(bindToggle);
  });
})();
