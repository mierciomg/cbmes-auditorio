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

const app = express();

// ROTAS
const authRoutes = require('./routes/auth.routes');
const reservasRoutes = require('./routes/reservas.routes');
const adminRoutes = require('./routes/admin.routes');
app.use('/api/checklist', checklistRoutes);


// ======================================================
// 🔐 SEGURANÇA BÁSICA (helmet)
// ======================================================
app.use(
  helmet({
    contentSecurityPolicy: false, // pra não quebrar JS/CSS do front
  })
);

// ======================================================
// 📊 LOG DE REQUISIÇÕES (morgan)
// ======================================================
// log no console no formato "dev"
// em produção dá pra trocar pra 'combined' e/ou gravar em arquivo
app.use(morgan('dev'));

// ======================================================
// 🔐 SESSÃO
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
// 📉 RATE LIMIT (proteção de rotas sensíveis)
// ======================================================

// Limite geral para /api (ex.: 1000 req / 15min por IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite mais rígido para login (ex.: 10 tentativas / 15min)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplica o limitador geral em todas as rotas de /api
app.use('/api', apiLimiter);

// Aplica o limitador específico só no endpoint de login
// (isso depende do prefixo que você usa; aqui estou assumindo POST /api/login)
app.post('/api/login', loginLimiter, (req, res, next) => next());

// ======================================================
// MIDDLEWARES BÁSICOS
// ======================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// FRONTEND (pasta public)
// ======================================================
app.use(express.static(path.join(__dirname, '..', 'public')));

// ======================================================
// ROTAS API
// ======================================================
app.use('/api', authRoutes);
app.use('/api', reservasRoutes);
app.use('/api', adminRoutes);

// ======================================================
// ROTA DE SAÚDE / TESTE
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
// INICIAR SERVIDOR
// ======================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
