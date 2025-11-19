// src/middleware/auth.middleware.js

// Middleware de autenticação baseado em SESSÃO
// Compatível com o auth.controller que usa req.session.user

exports.requireAdmin = (req, res, next) => {
  if (!req.session?.user?.admin) {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
};

