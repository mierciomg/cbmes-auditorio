// src/routes/admin.routes.js
const express = require('express');
const path = require('path');

const router = express.Router();

// Middleware simples: exige que o usuário esteja logado
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    // Se quiser, pode trocar para res.status(401).json(...)
    return res.redirect('/login.html');
  }
  next();
}

// Rota para servir o painel interno (admin.html)
router.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

module.exports = router;
