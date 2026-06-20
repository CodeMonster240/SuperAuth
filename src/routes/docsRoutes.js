const express = require('express');
const router = express.Router();

// Docs SPA shell routes. Frontend routing handles the individual docs pages.
router.get(['/', '/getting-started', '/callback-system', '/auth-flow', '/playground', '/button-widget'], (req, res) => {
  res.render('docs/index', { title: 'Documentation' });
});

module.exports = router;
