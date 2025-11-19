// src/routes/reservas.routes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const reservasController = require('../controllers/reservas.controller');

// ================== MIDDLEWARES BÁSICOS ==================

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.admin) {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

// ================== UPLOAD (ANEXO E-DOCS) ==================

const uploadDir = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const original = file.originalname || 'arquivo';
    cb(null, `${timestamp}__${original}`);
  }
});

const upload = multer({ storage });

// ================== ROTAS PÚBLICAS =========================

// Calendário público
router.get('/reservas-public', reservasController.listarPublicas);

// Períodos livres para o formulário de solicitação
router.get('/periodos-livres', reservasController.obterPeriodosLivres);

// Nova solicitação (externa/interna) com upload opcional
router.post('/reservas', upload.single('anexo_edocs'), reservasController.criarReserva);

// ================== ROTAS INTERNAS (PAINEL) ================

// Lista de todas as reservas (portal interno)
router.get('/reservas', requireAuth, reservasController.listarTodas);

// Atualizar status (aprovar / negar / cancelar)
router.patch('/reservas/:id/status', requireAuth, reservasController.atualizarStatus);

// Transformar agenda de "uso da corporação" em reserva interna normal
router.patch('/reservas/:id/transformar-uso', requireAuth, reservasController.transformarUsoCorporacaoEmReserva);


// Listar checklists (check-in / check-out) — apenas ADMIN
router.get(
  '/reservas/checklists',
  requireAuth,
  requireAdmin,
  reservasController.listarChecklists
);

module.exports = router;
