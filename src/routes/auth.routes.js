// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Middleware simples de autenticação (para alterar senha logado)
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  next();
}

// 🔹 NOVO: middleware para restringir acesso a administradores
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.admin) {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}


// =============== LOGIN / LOGOUT / ME ====================

// POST /api/login
router.post('/login', authController.login);

// POST /api/logout
router.post('/logout', authController.logout);

// GET /api/me
router.get('/me', authController.me);

// =============== ALTERAR SENHA (LOGADO) =================

// POST /api/alterar-senha
router.post('/alterar-senha', requireAuth, authController.alterarSenha);

// =============== ESQUECI MINHA SENHA ====================

// POST /api/forgot-password
router.post('/forgot-password', authController.forgotPassword);

// GET /api/reset-token?token=...
router.get('/reset-token', authController.checkResetToken);

// POST /api/reset-password
router.post('/reset-password', authController.resetPassword);

// =============== USUÁRIOS INTERNOS (ADMIN) ====================

// Listar
router.get('/usuarios', requireAdmin, authController.listarUsuarios);

// Criar
router.post('/usuarios', requireAdmin, authController.criarUsuario);

// Atualizar (aceita PUT e PATCH)
router.put('/usuarios/:id', requireAdmin, authController.atualizarUsuario);
router.patch('/usuarios/:id', requireAdmin, authController.atualizarUsuario);

// Ativar
router.patch('/usuarios/:id/ativar', requireAdmin, authController.ativarUsuario);

// Inativar
router.patch('/usuarios/:id/inativar', requireAdmin, authController.inativarUsuario);



module.exports = router;
