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
        checklist_token,
        checklist_respostas,
        checklist_preenchido_em,
        checklist_checkout_preenchido_em
      FROM auditorio_reserva
      WHERE checklist_token = $1
      `,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Token de checklist inválido ou não encontrado.' });
    }

    const reserva = rows[0];
    const hoje = hojeISO();
    const dataEvento = reserva.data_evento.toISOString().slice(0, 10);
    const dataFim = reserva.data_fim.toISOString().slice(0, 10);

    let podeResponder = true;
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
      }
    } else {
      // tipo === 'CHECKOUT'
      if (jsonRespostas && jsonRespostas.checkout) {
        respostasDoTipo = jsonRespostas.checkout;
      }

      if (reserva.checklist_checkout_preenchido_em) {
        jaPreenchido = true;
        motivoBloqueio = 'Este formulário de Check-OUT já foi preenchido.';
      } else if (hoje < dataFim) {
        motivoBloqueio =
          'O Check-OUT só poderá ser preenchido no último dia do evento (data de término).';
      }
    }

    if (motivoBloqueio) {
      podeResponder = false;
    }

    return res.json({
      reserva: {
        id: reserva.id,
        data_evento: dataEvento,
        data_fim: dataFim
      },
      tipoChecklist: tipo,
      podeResponder,
      motivoBloqueio,
      jaPreenchido,
      respostas: respostasDoTipo || null
    });
  } catch (err) {
    console.error('Erro ao obter checklist por token:', err);
    return res.status(500).json({ error: 'Erro ao obter dados do checklist.' });
  }
};

// POST /api/checklist/:token?tipo=CHECKIN|CHECKOUT
exports.responderChecklist = async (req, res) => {
  const { token } = req.params;
  const tipo = normalizarTipo(req.query.tipo || req.body.tipo_checklist);
  const payload = req.body || {};

  console.log('PAYLOAD CHECKLIST (req.body):', req.body);


  try {
    // 1) Localiza reserva pelo token
    const { rows } = await db.query(
      `
      SELECT
        id,
        data_evento::date       AS data_evento,
        COALESCE(data_fim, data_evento)::date AS data_fim,
        checklist_respostas,
        checklist_preenchido_em,
        checklist_checkout_preenchido_em
      FROM auditorio_reserva
      WHERE checklist_token = $1
      `,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Token de checklist inválido ou não encontrado.' });
    }

    const reserva = rows[0];
    const hoje = hojeISO();
    const dataEvento = reserva.data_evento.toISOString().slice(0, 10);
    const dataFim = reserva.data_fim.toISOString().slice(0, 10);

    const base = reserva.checklist_respostas || {};

    // ===================== CHECK-IN =====================
    if (tipo === 'CHECKIN') {
      let novoJson;
      if (base.checkin || base.checkout) {
        novoJson = { ...base, checkin: payload };
      } else {
        novoJson = { checkin: payload, ...base };
      }

      // mantém comportamento legado
      await db.query(
        `
        UPDATE auditorio_reserva
           SET checklist_respostas     = $1,
               checklist_preenchido_em = NOW()
         WHERE checklist_token = $2
        `,
        [novoJson, token]
      );

      // 🔹 NOVO: grava na auditorio_checklist
      // checkbox "concordo_uso" / campo booleano "concordou_uso"
      // - Se vier boolean (concordou_uso) usamos direto
      // - Se vier do formulário como string "on" (concordo_uso), convertemos para true
      let concordouUso = false;
      if (typeof payload.concordou_uso === 'boolean') {
        concordouUso = payload.concordou_uso;
      } else if (typeof payload.concordo_uso !== 'undefined') {
        concordouUso = !!payload.concordo_uso;
      }

      await db.query(
        `
        INSERT INTO auditorio_checklist (
          reserva_id,
          tipo,
          preenchido_em,
          concordou_uso,
          houve_alteracoes,
          confirmacao_raw,
          respostas
        )
        VALUES ($1, 'CHECKIN', NOW(), $2, NULL, NULL, $3)
        `,
        [reserva.id, concordouUso, payload]
      );

      return res.status(201).json({ ok: true, tipoChecklist: tipo });
    }

    // ===================== CHECK-OUT =====================
    // tipo === 'CHECKOUT'
    const novoJson = { ...base, checkout: payload };

    // 1) atualiza na reserva (JSON + data)
    await db.query(
      `
      UPDATE auditorio_reserva
         SET checklist_respostas              = $1,
             checklist_checkout_preenchido_em = NOW()
       WHERE checklist_token = $2
      `,
      [novoJson, token]
    );

    // 2) calcula se houve alterações
    let houveAlteracoes = false;

    if (typeof payload.checkout_com_alteracoes === 'boolean') {
      houveAlteracoes = payload.checkout_com_alteracoes;
    } else {
      const confVal = String(payload.confirmacao_checkout || '')
        .trim()
        .toUpperCase();
      if (confVal.includes('COM')) {
        houveAlteracoes = true;
      }
    }

    // atualiza flag na reserva (legado)
    await db.query(
      `
      UPDATE auditorio_reserva
         SET checkout_com_alteracoes = $1
       WHERE checklist_token = $2
      `,
      [houveAlteracoes, token]
    );

    // 3) grava também na auditorio_checklist
    await db.query(
      `
      INSERT INTO auditorio_checklist (
        reserva_id,
        tipo,
        preenchido_em,
        concordou_uso,
        houve_alteracoes,
        confirmacao_raw,
        respostas
      )
      VALUES ($1, 'CHECKOUT', NOW(), NULL, $2, $3, $4)
      `,
      [reserva.id, houveAlteracoes, payload.confirmacao_checkout || null, payload]
    );

    return res.status(201).json({
      ok: true,
      tipoChecklist: tipo,
      checkout_com_alteracoes: houveAlteracoes
    });
  } catch (err) {
    console.error('Erro ao salvar checklist:', err);
    return res.status(500).json({ error: 'Erro ao salvar respostas do checklist.' });
  }
};
