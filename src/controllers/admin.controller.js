// src/controllers/admin.controller.js
const pool = require('../db');

exports.listarTodas = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM reservas ORDER BY data_evento DESC, hora_inicio DESC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar reservas internas:', err);
    return res.status(500).json({ erro: 'Erro ao listar reservas internas' });
  }
};

// Exemplo para aprovar:
exports.aprovar = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE reservas SET status = 'APROVADA' WHERE id = $1`,
      [id]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao aprovar reserva:', err);
    return res.status(500).json({ erro: 'Erro ao aprovar reserva' });
  }
};
