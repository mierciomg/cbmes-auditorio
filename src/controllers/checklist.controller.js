// src/controllers/checklist.controller.js
const db = require('../db');

function hojeISO() {
  const hoje = new Date();
  return hoje.toISOString().slice(0, 10); // yyyy-mm-dd
}

function normalizarTipo(raw) {
  const t = (raw || '').toString().trim().toUpperCase();
  if (t === 'CHECKOUT') return 'CHECKOUT';
  return 'CHECKIN';
}

// GET /api/checklist/:token?tipo=CHECKIN|CHECKOUT
exports.obterChecklistPorToken = async (req, res) => {
  const { token } = req.params;
  const tipo = normalizarTipo(req.query.tipo); // default CHECKIN

  try {
    const { rows } = await db.query(
      `
      SELECT
        id,
        data_evento::date       AS data_evento,
        COALESCE(data_fim, data_evento)::date AS data_fim,
        instituicao,
        responsavel,
        email,
        status,
        checklist_preenchido_em,
        checklist_checkout_preenchido_em,
        checklist_respostas
      FROM auditorio_reserva
      WHERE checklist_token = $1
      `,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Link inválido ou não encontrado.' });
    }

    const reserva = rows[0];

    const hoje = hojeISO();
    const dataEvento = reserva.data_evento.toISOString().slice(0, 10);
    const dataFim = reserva.data_fim.toISOString().slice(0, 10);

    let podeResponder = false;
    let motivoBloqueio = null;
    let jaPreenchido = false;
    let respostasDoTipo = null;

    const jsonRespostas = reserva.checklist_respostas || {};

    if (tipo === 'CHECKIN') {
      // Respostas já gravadas para check-in
      if (jsonRespostas && jsonRespostas.checkin) {
        respostasDoTipo = jsonRespostas.checkin;
      } else if (jsonRespostas && !jsonRespostas.checkout) {
        // legado: antes só existia um bloco único
        respostasDoTipo = jsonRespostas;
      }

      if (reserva.checklist_preenchido_em) {
        jaPreenchido = true;
        motivoBloqueio = 'Este formulário de Check-IN já foi preenchido.';
      } else if (hoje < dataEvento) {
        motivoBloqueio = 'Este formulário de Check-IN só poderá ser preenchido no dia do evento.';
      } else if (hoje > dataEvento) {
        motivoBloqueio = 'O prazo para preenchimento do Check-IN já encerrou.';
      } else {
        podeResponder = true;
      }

    } else {
      // CHECKOUT
      if (jsonRespostas && jsonRespostas.checkout) {
        respostasDoTipo = jsonRespostas.checkout;
      }

      if (reserva.checklist_checkout_preenchido_em) {
        jaPreenchido = true;
        motivoBloqueio = 'Este formulário de Check-OUT já foi preenchido.';
      } else if (hoje < dataFim) {
        motivoBloqueio = 'O Check-OUT só poderá ser realizado no último dia do evento.';
      } else if (hoje > dataFim) {
        motivoBloqueio = 'O prazo para preenchimento do Check-OUT já encerrou.';
      } else {
        podeResponder = true;
      }
    }

    return res.json({
      reserva: {
        id: reserva.id,
        data_evento: dataEvento,
        data_fim: dataFim,
        instituicao: reserva.instituicao,
        responsavel: reserva.responsavel,
        email: reserva.email,
        status: reserva.status
      },
      tipoChecklist: tipo,
      podeResponder,
      motivoBloqueio,
      jaPreenchido,
      respostas: respostasDoTipo
    });

  } catch (err) {
    console.error('Erro ao carregar checklist:', err);
    return res.status(500).json({ error: 'Erro ao carregar checklist.' });
  }
};

// POST /api/checklist/:token?tipo=CHECKIN|CHECKOUT
exports.responderChecklist = async (req, res) => {
  const { token } = req.params;
  const tipo = normalizarTipo(req.query.tipo || req.body.tipo_checklist);
  const hoje = hojeISO();

  try {
    const { rows } = await db.query(
      `
      SELECT
        id,
        data_evento::date       AS data_evento,
        COALESCE(data_fim, data_evento)::date AS data_fim,
        checklist_preenchido_em,
        checklist_checkout_preenchido_em,
        checklist_respostas
      FROM auditorio_reserva
      WHERE checklist_token = $1
      `,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Link inválido ou não encontrado.' });
    }

    const reserva = rows[0];

    const dataEvento = reserva.data_evento.toISOString().slice(0, 10);
    const dataFim = reserva.data_fim.toISOString().slice(0, 10);

    let dataReferencia = dataEvento;
    let jaPreenchido = false;

    if (tipo === 'CHECKIN') {
      dataReferencia = dataEvento;
      jaPreenchido = !!reserva.checklist_preenchido_em;
    } else {
      dataReferencia = dataFim;
      jaPreenchido = !!reserva.checklist_checkout_preenchido_em;
    }

    if (jaPreenchido) {
      return res.status(400).json({
        error:
          tipo === 'CHECKIN'
            ? 'Este formulário de Check-IN já foi preenchido.'
            : 'Este formulário de Check-OUT já foi preenchido.'
      });
    }

    if (hoje < dataReferencia) {
      return res.status(400).json({
        error:
          tipo === 'CHECKIN'
            ? 'Este formulário de Check-IN só pode ser preenchido no dia do evento.'
            : 'O Check-OUT só pode ser realizado no último dia do evento.'
      });
    }

    if (hoje > dataReferencia) {
      return res.status(400).json({
        error:
          tipo === 'CHECKIN'
            ? 'O prazo para preenchimento do Check-IN já encerrou.'
            : 'O prazo para preenchimento do Check-OUT já encerrou.'
      });
    }

    const payload = req.body || {};
    let base = reserva.checklist_respostas;

    if (!base || typeof base !== 'object') {
      base = {};
    }

    let novoJson;

    if (tipo === 'CHECKIN') {
      // Se já tinha um JSON "solto" sem checkin/checkout, preserva como checkin legado
      if (base.checkin || base.checkout) {
        novoJson = { ...base, checkin: payload };
      } else {
        novoJson = { checkin: payload, ...base };
      }

      await db.query(
        `
        UPDATE auditorio_reserva
           SET checklist_respostas     = $1,
               checklist_preenchido_em = NOW()
         WHERE checklist_token = $2
        `,
        [novoJson, token]
      );
    } else {
      // ==========================
      // CHECKOUT
      // ==========================

      novoJson = { ...base, checkout: payload };

      // Tenta descobrir no payload se houve alterações
      // (cobrindo vários nomes possíveis de campo)
      let houveAlteracoes = false;

      const brutoAlteracoes =
        payload.checkout_com_alteracoes ??
        payload.checkout_alteracoes ??
        payload.houve_alteracoes ??
        payload.alteracoes;

      if (typeof brutoAlteracoes === 'string') {
        const v = brutoAlteracoes.trim().toUpperCase();
        if (['SIM', 'S', 'TRUE', '1'].includes(v)) {
          houveAlteracoes = true;
        }
      } else if (typeof brutoAlteracoes === 'boolean') {
        houveAlteracoes = brutoAlteracoes;
      } else if (typeof brutoAlteracoes === 'number') {
        houveAlteracoes = brutoAlteracoes === 1;
      }

      await db.query(
        `
        UPDATE auditorio_reserva
           SET checklist_respostas              = $1,
               checklist_checkout_preenchido_em = NOW(),
               checkout_com_alteracoes          = $2
         WHERE checklist_token = $3
        `,
        [novoJson, houveAlteracoes, token]
      );
    }

    return res.status(201).json({ ok: true, tipoChecklist: tipo });
  } catch (err) {
    console.error('Erro ao salvar checklist:', err);
    return res.status(500).json({ error: 'Erro ao salvar respostas do checklist.' });
  }
};

