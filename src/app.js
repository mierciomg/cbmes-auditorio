// src/app.js
const express = require('express');
const session = require('express-session');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();
const pool = require('./db');

const checklistRoutes = require('./routes/checklist.routes');
const authRoutes = require('./routes/auth.routes');
const reservasRoutes = require('./routes/reservas.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// ======================================================
// 1) PARSE DE BODY (JSON / FORM)
// ======================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// 2) SEGURANÇA BÁSICA (helmet)
// ======================================================
app.use(
  helmet({
    contentSecurityPolicy: false, // pra não quebrar JS/CSS do front
  })
);

// ======================================================
// 3) LOG DE REQUISIÇÕES (morgan)
// ======================================================
app.use(morgan('dev'));

// ======================================================
// 4) SESSÃO
// ======================================================
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'alguma_coisa_bem_grande_e_dificil',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
      secure: false,              // em produção com HTTPS → true
      httpOnly: true,
    },
  })
);

// ======================================================
// 5) RATE LIMIT (proteção de rotas sensíveis)
// ======================================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite geral para /api
app.use('/api', apiLimiter);

// Limite específico de login
app.post('/api/login', loginLimiter, (req, res, next) => next());

// ======================================================
// 6) FRONTEND (pasta public)
// ======================================================
app.use(express.static(path.join(__dirname, '..', 'public')));

// ======================================================
// 6.1) PASTA DE UPLOADS (acesso a anexos)
// ======================================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// ======================================================
// 7) ROTAS API
// ======================================================
app.use('/api/checklist', checklistRoutes);
app.use('/api', authRoutes);
app.use('/api', reservasRoutes);
app.use('/api', adminRoutes);

// ======================================================
// 8) ROTA DE SAÚDE / TESTE
// ======================================================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Erro em /api/health:', err.message);
    res.status(500).json({ status: 'erro', detalhe: err.message });
  }
});

// ======================================================
// 9) INICIAR SERVIDOR
// ======================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
