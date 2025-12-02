// src/db.js
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERRO: DATABASE_URL não definida nas variáveis de ambiente.');
  throw new Error('DATABASE_URL não configurada');
}

// Se DB_SSL = 'true', usa SSL; senão, não usa.
const useSSL = process.env.DB_SSL === 'true';

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
