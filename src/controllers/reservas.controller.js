// src/controllers/reservas.controller.js
const db = require('../db');
const mailer = require('../mailer');
const { v4: uuidv4 } = require('uuid'); // 🔹 NOVO: para gerar token do checklist

// Helper só usado aqui
function normalizarTipoSolicitacao(valor) {
  if (!valor) return null;
  const t = valor.toString().trim().toUpperCase();
  if (t === 'INTERNA' || t === 'EXTERNA') return t;
  return null;
}

// ================== CALENDÁRIO PÚBLICO ==================

exports.listarPublicas = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         id,
         data_evento,
         data_fim,
         periodo,
         tipo_solicitacao,
         instituicao,
         responsavel,
         email,
         telefone,
         finalidade,
         observacoes,
         status
       FROM auditorio_reserva
       WHERE status IN ('PENDENTE', 'APROVADA')
       ORDER BY data_evento ASC, periodo ASC`
    );

    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar reservas públicas:', err);
    res.status(500).json({ error: 'Erro ao listar reservas públicas.' });
  }
};

// ================== LISTA INTERNA (PORTAL) ===============

exports.listarTodas = async (req, res) => {
  try {
    // escopo vindo da sessão do usuário logado
    const escopo = req.session?.user?.escopo || 'AMBOS';

    let where = '';

    if (escopo === 'INTERNA') {
      where = `WHERE tipo_solicitacao = 'INTERNA'`;
    } else if (escopo === 'EXTERNA') {
      where = `WHERE tipo_solicitacao = 'EXTERNA'`;
    }
    // se for AMBOS → where fica vazio (vê tudo)

    const { rows } = await db.query(
      `SELECT id,
              data_evento,
              data_fim,
              periodo,
              tipo_solicitacao,
              instituicao,
              responsavel,
              email,
              telefone,
              finalidade,
              observacoes,
              anexo_url,
              status,
              analisado_por,
              analisado_email,
              motivo_decisao,
              data_decisao,
              criado_em
         FROM auditorio_reserva
         ${where}
        ORDER BY status = 'PENDENTE' DESC,
                 data_evento ASC,
                 periodo ASC`
    );

    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar reservas:', err);
    res.status(500).json({ error: 'Erro ao listar reservas.' });
  }
};


// ================== PERÍODOS LIVRES ======================
exports.obterPeriodosLivres = async (req, res) => {
  const { data } = req.query;

  if (!data) {
    return res
      .status(400)
      .json({ error: 'Parâmetro "data" é obrigatório (YYYY-MM-DD).' });
  }

  // helper para "traduzir" o que está no banco para os IDs usados no sistema
  function normalizarPeriodoBanco(valor) {
    if (!valor) return null;
    const txt = valor.toString().trim().toUpperCase();

    // integral
    if (txt === 'INTEGRAL' || txt.startsWith('INTEGRAL')) return 'INTEGRAL';

    // manhã – com ou sem acento, com descrição, etc.
    if (
      txt === 'MANHA' ||
      txt === 'MANHÃ' ||
      txt.startsWith('MANHA') ||
      txt.startsWith('MANHÃ')
    ) {
      return 'MANHA';
    }

    // tarde
    if (txt === 'TARDE' || txt.startsWith('TARDE')) return 'TARDE';

    // noite
    if (txt === 'NOITE' || txt.startsWith('NOITE')) return 'NOITE';

    // fallback: devolve do jeito que veio
    return txt;
  }

  try {
    const { rows } = await db.query(
      `SELECT periodo, status
         FROM auditorio_reserva
        WHERE $1 BETWEEN data_evento AND COALESCE(data_fim, data_evento)
          AND status IN ('PENDENTE', 'APROVADA')`,
      [data]
    );

    // 1) Normaliza o que veio do banco
    const ocupadosNorm = rows
      .map(r => normalizarPeriodoBanco(r.periodo))
      .filter(p => !!p);

    // 2) Expande para bloquear períodos que se sobrepõem
    const ocupados = new Set();

    ocupadosNorm.forEach(id => {
      switch (id) {
        case 'INTEGRAL':
          // dia todo até 18h: bloqueia MANHA, TARDE e o próprio INTEGRAL
          ocupados.add('INTEGRAL');
          ocupados.add('MANHA');
          ocupados.add('TARDE');
          break;

        case 'MANHA':
          // manhã ocupa parte do integral
          ocupados.add('MANHA');
          ocupados.add('INTEGRAL');
          break;

        case 'TARDE':
          // tarde idem
          ocupados.add('TARDE');
          ocupados.add('INTEGRAL');
          break;

        case 'NOITE':
          // noite só bloqueia a própria noite
          ocupados.add('NOITE');
          break;

        default:
          ocupados.add(id);
      }
    });

    const todosPeriodos = [
      { id: 'INTEGRAL', label: 'Integral (08h às 18h)' },
      { id: 'MANHA',    label: 'Manhã (08h às 12h)' },
      { id: 'TARDE',    label: 'Tarde (13h às 17h)' },
      { id: 'NOITE',    label: 'Noite (18h às 21h)' }
    ];

    const livres = todosPeriodos.filter(p => !ocupados.has(p.id));

    return res.json(livres);
  } catch (err) {
    console.error('Erro ao consultar períodos livres:', err);
    return res
      .status(500)
      .json({ error: 'Erro ao consultar períodos livres.' });
  }
};



// ================== NOVA RESERVA (EXTERNA/INTERNA) =======

exports.criarReserva = async (req, res) => {
  try {
    const {
      data_evento,
      data_fim,           // opcional
      periodo,
      tipo_solicitacao,
      instituicao,
      responsavel,
      email,
      telefone,
      finalidade,
      observacoes
    } = req.body;

    const tipo = normalizarTipoSolicitacao(tipo_solicitacao);

    // se o front ainda não manda data_fim, usamos a mesma da data_evento
    const dataFimFinal = (data_fim && data_fim.trim() !== '') ? data_fim : data_evento;

    const arquivo = req.file;
    const anexo_url = arquivo ? `/uploads/${arquivo.filename}` : null;

    if (!data_evento || !dataFimFinal || !periodo || !instituicao || !responsavel ||
      !email || !telefone || !finalidade || !tipo) {
      return res.status(400).json({ error: 'Campos obrigatórios não informados.' });
    }

    if (!['INTERNA', 'EXTERNA'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de solicitação inválido (use Interna ou Externa).' });
    }

    if (tipo === 'EXTERNA' && !arquivo) {
      return res.status(400).json({
        error: 'Para solicitações EXTERNAS é obrigatório anexar o arquivo EDOCs.'
      });
    }

    if (dataFimFinal < data_evento) {
      return res.status(400).json({ error: 'Data final não pode ser anterior à data inicial.' });
    }

    // Verificar conflito de período com outras reservas (PENDENTE/APROVADA)
    const conflitoQuery = `
      SELECT 1
        FROM auditorio_reserva
       WHERE periodo = $1
         AND status IN ('PENDENTE','APROVADA')
         AND NOT ($3 < data_evento OR $2 > COALESCE(data_fim, data_evento))
       LIMIT 1;
    `;
    const conflitoValues = [periodo, data_evento, dataFimFinal];
    const conflito = await db.query(conflitoQuery, conflitoValues);

    if (conflito.rows.length > 0) {
      return res.status(400).json({
        error: 'Já existe reserva para este período em parte do intervalo de datas informado.'
      });
    }

    const insertQuery = `
      INSERT INTO auditorio_reserva
      (data_evento, data_fim, periodo, tipo_solicitacao,
       instituicao, responsavel, email, telefone,
       finalidade, observacoes, anexo_url, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDENTE')
      RETURNING *;
    `;

    const values = [
      data_evento,
      dataFimFinal,
      periodo,
      tipo,
      instituicao,
      responsavel,
      email,
      telefone,
      finalidade,
      observacoes || null,
      anexo_url
    ];

    const { rows } = await db.query(insertQuery, values);
    const reserva = rows[0];

    // responde para o front
    res.status(201).json(reserva);

    // dispara e-mail de recebimento em background
    mailer.enviarEmailNovaReserva(reserva).catch(err => {
      console.error('Falha ao enviar e-mail de nova reserva:', err);
    });

  } catch (err) {
    console.error('Erro ao criar reserva:', err);

    if (err.code === '23505' && err.constraint === 'ux_auditorio_reserva_data_periodo_ativa') {
      return res.status(400).json({
        error: 'Já existe uma solicitação APROVADA ou PENDENTE para esta data e período. Escolha outro horário ou período.'
      });
    }

    return res.status(500).json({ error: 'Erro ao criar reserva.' });
  }
};

// ================== ATUALIZA STATUS (APROVAR/NEGAR) =====

exports.atualizarStatus = async (req, res) => {
  const { id } = req.params;
  const { status, motivo_decisao, ocupar_corporacao } = req.body;

  const statusUpper = (status || '').toUpperCase();

  if (!['PENDENTE', 'APROVADA', 'NEGADA', 'CANCELADA'].includes(statusUpper)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  if ((statusUpper === 'NEGADA' || statusUpper === 'CANCELADA') &&
    (!motivo_decisao || motivo_decisao.trim() === '')) {
    return res.status(400).json({
      error: 'Para negar ou cancelar uma reserva é obrigatório informar o motivo.'
    });
  }

  // usuário logado (vem da sessão)
  const usuario = req.session?.user;
  if (!usuario) {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }

  const analisadoPor = usuario.nome || 'Usuário CBMES';
  const analisadoEmail = usuario.email || null;

  try {
    const updateQuery = `
      UPDATE auditorio_reserva
         SET status          = $1,
             analisado_por   = $2,
             analisado_email = $3,
             motivo_decisao  = $4,
             data_decisao    = NOW()
       WHERE id = $5
      RETURNING *;
    `;

    const values = [
      statusUpper,
      analisadoPor,
      analisadoEmail,
      motivo_decisao || null,
      id
    ];

    const { rows } = await db.query(updateQuery, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    // 🔹 precisa ser let porque podemos atualizar reservaAtualizada depois (quando gerar token)
    let reservaAtualizada = rows[0];

    // 🔹 Se a reserva foi NEGADA e o analista marcou para ocupar como uso interno da Corporação,
    // criamos um novo registro "interno" APROVADO para bloquear a data/período no calendário.
    if (statusUpper === 'NEGADA' && ocupar_corporacao === true) {
      try {
        // Aproveita o e-mail/telefone originais, ou usa um padrão se vier nulo
        const emailUso = reservaAtualizada.email || 'uso.corporacao@cbmes.es.gov.br';
        const telefoneUso = reservaAtualizada.telefone || '';

        await db.query(
          `INSERT INTO auditorio_reserva
           (data_evento, data_fim, periodo, tipo_solicitacao,
            instituicao, responsavel, email, telefone,
            finalidade, observacoes, anexo_url, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'APROVADA')`,
          [
            reservaAtualizada.data_evento,      // $1
            reservaAtualizada.data_fim,         // $2
            reservaAtualizada.periodo,          // $3
            'INTERNA',                          // $4 tipo_solicitacao
            'CBMES / Corporação',               // $5 instituicao
            'Uso interno CBMES',                // $6 responsavel
            emailUso,                           // $7 email (NÃO é null)
            telefoneUso,                        // $8 telefone
            'Em uso da Corporação',             // $9 finalidade
            null,                               // $10 observacoes
            null                                // $11 anexo_url
          ]
        );
      } catch (errInsercao) {
        console.error('Erro ao criar reserva interna de uso da Corporação:', errInsercao);
        // não impede a resposta principal; só registramos o problema
      }
    }

    // 🔹 NOVO BLOCO: gerar token de checklist ao aprovar, se ainda não tiver
    if (statusUpper === 'APROVADA') {
      let checklistToken = reservaAtualizada.checklist_token;

      if (!checklistToken) {
        checklistToken = uuidv4();

        const { rows: rowsChecklist } = await db.query(
          `
      UPDATE auditorio_reserva
         SET checklist_token = $1
       WHERE id = $2
      RETURNING *;
      `,
          [checklistToken, reservaAtualizada.id]
        );

        if (rowsChecklist.length > 0) {
          reservaAtualizada = rowsChecklist[0];
        } else {
          reservaAtualizada.checklist_token = checklistToken;
        }
      }

      const baseUrl = (process.env.APP_PUBLIC_URL || '').replace(/\/+$/, '');

      // Link para o Check-IN (início do evento)
      const checklistLink = `${baseUrl}/checklist.html?token=${checklistToken}`;

      // Link para o Check-OUT (último dia do evento)
      const checklistCheckoutLink = `${baseUrl}/checklist-out.html?token=${checklistToken}`;

      reservaAtualizada.checklist_link = checklistLink;
      reservaAtualizada.checklist_checkout_link = checklistCheckoutLink;
    }

    mailer.enviarEmailDecisaoReserva(reservaAtualizada).catch(err => {
      console.error('Falha ao enviar e-mail de decisão:', err);
    });

    res.json(reservaAtualizada);
  } catch (err) {
    console.error('Erro ao atualizar status:', err);
    return res.status(500).json({ error: 'Erro ao atualizar status da reserva.' });
  }
};


// ================== TRANSFORMAR "USO DA CORPORAÇÃO" EM RESERVA NORMAL ==================

/**
 * Permite que um usuário interno pegue uma reserva criada como
 * "Em uso da Corporação" e transforme em uma reserva interna "normal",
 * preenchendo dados reais de instituição, responsável, finalidade etc.
 *
 * Regras:
 * - Precisa estar logado (req.session.user).
 * - Só funciona se:
 *    - status = 'APROVADA'
 *    - tipo_solicitacao = 'INTERNA'
 *    - finalidade = 'Em uso da Corporação'
 */
exports.transformarUsoCorporacaoEmReserva = async (req, res) => {
  const { id } = req.params;
  const {
    instituicao,
    responsavel,
    email,
    telefone,
    finalidade,
    observacoes
  } = req.body;

  // usuário logado (vem da sessão)
  const usuario = req.session?.user;
  if (!usuario) {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }

  // validações básicas dos novos dados
  if (!responsavel || !finalidade) {
    return res.status(400).json({
      error: 'Responsável e finalidade são obrigatórios para transformar em reserva.'
    });
  }

  try {
    // busca a reserva original
    const { rows } = await db.query(
      `SELECT *
         FROM auditorio_reserva
        WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    const reserva = rows[0];

    // garante que é um registro de "uso da corporação"
    const isUsoCorporacao =
      reserva.status === 'APROVADA' &&
      reserva.tipo_solicitacao === 'INTERNA' &&
      reserva.finalidade === 'Em uso da Corporação';

    if (!isUsoCorporacao) {
      return res.status(400).json({
        error: 'Esta reserva não está marcada como "Em uso da Corporação".'
      });
    }

    const novaInstituicao = (instituicao && instituicao.trim()) || reserva.instituicao;
    const novoResponsavel = responsavel.trim();
    const novoEmail = (email && email.trim()) || reserva.email;
    const novoTelefone = (telefone && telefone.trim()) || reserva.telefone;
    const novaFinalidade = finalidade.trim();
    const novasObs = (observacoes && observacoes.trim()) || reserva.observacoes;

    const updateSql = `
      UPDATE auditorio_reserva
         SET instituicao = $1,
             responsavel = $2,
             email       = $3,
             telefone    = $4,
             finalidade  = $5,
             observacoes = $6
       WHERE id = $7
      RETURNING *;
    `;

    const { rows: rowsUpd } = await db.query(updateSql, [
      novaInstituicao,
      novoResponsavel,
      novoEmail,
      novoTelefone,
      novaFinalidade,
      novasObs,
      id
    ]);

    const reservaAtualizada = rowsUpd[0];

    // (Opcional) Poderia disparar um e-mail interno avisando da alteração
    // mailer.enviarEmailTransformacaoUsoCorporacao(reservaAtualizada).catch(...);

    return res.json(reservaAtualizada);
  } catch (err) {
    console.error('Erro ao transformar uso da corporação em reserva:', err);
    return res.status(500).json({
      error: 'Erro ao transformar uso da corporação em reserva.'
    });
  }
};





// ================== LISTA DE CHECKLISTS (CHECK-IN / CHECK-OUT) ===============

exports.listarChecklists = async (req, res) => {
  const db = require('../db'); // se já tiver db no topo do arquivo, não precisa repetir isso

  try {
    const {
      id,                 // opcional - id da reserva
      tipo_solicitacao,   // INTERNA / EXTERNA
      data_ini,           // filtro de período - data inicial
      data_fim,           // filtro de período - data final
      concordou_uso,      // SIM / NAO (check-in)
      checkout_alteracoes // SIM / NAO (check-out com alterações)
    } = req.query;

    const params = [];
    const where = [];

    if (id) {
      params.push(Number(id));
      where.push(`id = $${params.length}`);
    }

    if (tipo_solicitacao) {
      params.push(tipo_solicitacao.toUpperCase());
      where.push(`tipo_solicitacao = $${params.length}`);
    }

    if (data_ini) {
      params.push(data_ini);
      where.push(`data_evento >= $${params.length}`);
    }

    if (data_fim) {
      params.push(data_fim);
      where.push(`COALESCE(data_fim, data_evento) <= $${params.length}`);
    }

    if (concordou_uso === 'SIM') {
      where.push(`(checklist_respostas -> 'checkin' ->> 'concordo_uso') IS NOT NULL`);
    } else if (concordou_uso === 'NAO') {
      where.push(`(checklist_respostas -> 'checkin' ->> 'concordo_uso') IS NULL`);
    }

    if (checkout_alteracoes === 'SIM') {
      where.push(`(checklist_respostas -> 'checkout' ->> 'confirmacao_checkout') = 'COM_ALTERACOES'`);
    } else if (checkout_alteracoes === 'NAO') {
      where.push(`(checklist_respostas -> 'checkout' ->> 'confirmacao_checkout') = 'SEM_ALTERACOES'`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT
        id,
        data_evento,
        COALESCE(data_fim, data_evento) AS data_fim,
        tipo_solicitacao,
        periodo,
        instituicao,
        responsavel,
        email,
        checklist_preenchido_em,
        checklist_checkout_preenchido_em,
        (checklist_respostas -> 'checkin') IS NOT NULL                         AS checkin_feito,
        (checklist_respostas -> 'checkout') IS NOT NULL                        AS checkout_feito,
        (checklist_respostas -> 'checkin' ->> 'concordo_uso') IS NOT NULL      AS concordou_uso,
        (checklist_respostas -> 'checkout' ->> 'confirmacao_checkout') = 'COM_ALTERACOES'
                                                                               AS checkout_com_alteracoes,
        checklist_respostas
      FROM auditorio_reserva
      ${whereClause}
      ORDER BY data_evento DESC, id DESC
      LIMIT 500;
    `;

    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar checklists:', err);
    res.status(500).json({ error: 'Erro ao listar checklists (check-in / check-out).' });
  }
};


