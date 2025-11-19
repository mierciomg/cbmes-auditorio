// src/mailer.js
const { enviarEmail } = require('./services/mail.service');

// Helper simples para formatar datas
function formatarData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

// HTML padrão para o topo + rodapé
function layoutBase(conteudo) {
  return `
    <div style="font-family: Arial, sans-serif; color:#333; max-width:650px;">
      <h2 style="color:#8a0000; margin-bottom:10px;">
        Sistema de Agendamento do Auditório – CBMES
      </h2>

      <div style="padding:14px 18px; border-radius:8px; background:#fafafa; border:1px solid #ddd;">
        ${conteudo}
      </div>

      <p style="margin-top:20px; font-size:12px; color:#666;">
        Este é um e-mail automático. Não responda.
      </p>
    </div>
  `;
}

// ======================================================
// 1) Email – Nova solicitação recebida
// ======================================================
async function enviarEmailNovaReserva(reserva) {
  const conteudo = `
    <p>Prezado(a) <strong>${reserva.responsavel}</strong>,</p>
    
    <p>Sua solicitação de uso do auditório foi registrada com sucesso.</p>

    <p><strong>Detalhes da solicitação:</strong></p>

    <ul>
      <li><strong>Data inicial:</strong> ${formatarData(reserva.data_evento)}</li>
      <li><strong>Data final:</strong> ${formatarData(reserva.data_fim || reserva.data_evento)}</li>
      <li><strong>Período:</strong> ${reserva.periodo}</li>
      <li><strong>Responsável:</strong> ${reserva.responsavel}</li>
      <li><strong>Instituição:</strong> ${reserva.instituicao}</li>
    </ul>

    <p>Você receberá novo e-mail assim que a solicitação for analisada.</p>
  `;

  await enviarEmail({
    to: reserva.email,
    subject: 'Solicitação registrada – Auditório CBMES',
    html: layoutBase(conteudo),
  });
}

// ======================================================
// 2) Email – Decisão (APROVADA / NEGADA / CANCELADA)
// ======================================================
async function enviarEmailDecisaoReserva(reserva) {
  const status = reserva.status;

  let conteudo = `
    <p>Prezado(a) <strong>${reserva.responsavel}</strong>,</p>
  `;

  if (status === 'APROVADA') {
  conteudo += `
      <p>Informamos que a sua solicitação de uso do auditório foi 
        <strong style="color:green">APROVADA</strong>.
      </p>

      <p><strong>Data inicial do evento:</strong> ${formatarData(reserva.data_evento)}</p>
      <p><strong>Data final do evento:</strong> ${formatarData(reserva.data_fim || reserva.data_evento)}</p>
      <p><strong>Período:</strong> ${reserva.periodo || ''}</p>

      <hr style="border:none; border-top:1px solid #ddd; margin:14px 0;" />

      <p style="margin:10px 0 4px;"><strong>Check-IN do auditório (entrada):</strong></p>
      <p style="font-size:13px; margin:0 0 6px;">
        No <strong>dia do início do evento</strong>, ao chegar ao auditório, acesse o formulário abaixo para registrar as condições de recebimento do espaço:
      </p>
      <p style="margin:8px 0 18px;">
        <a href="${reserva.checklist_link}" 
           style="background:#8a0000; color:#fff; padding:10px 16px; border-radius:6px; 
                  text-decoration:none; font-weight:bold;"
           target="_blank">
          Preencher Check-IN do auditório
        </a>
      </p>

      <p style="margin:10px 0 4px;"><strong>Check-OUT do auditório (encerramento):</strong></p>
      <p style="font-size:13px; margin:0 0 6px;">
        No <strong>último dia do evento</strong>, antes de deixar o auditório, acesse o formulário abaixo para registrar as condições de devolução do espaço:
      </p>
      <p style="margin:8px 0 10px;">
        <a href="${reserva.checklist_checkout_link}" 
           style="background:#444; color:#fff; padding:10px 16px; border-radius:6px; 
                  text-decoration:none; font-weight:bold;"
           target="_blank">
          Preencher Check-OUT do auditório
        </a>
      </p>

      <p style="font-size:12px; color:#a00; margin-top:10px;">
        <strong>Atenção:</strong> o Check-IN só poderá ser preenchido no dia do início do evento, e o Check-OUT somente no último dia do evento.
      </p>
    `;

  } else if (status === 'NEGADA') {
    conteudo += `
      <p style="color:#a00000;"><strong>Sua solicitação foi NEGADA.</strong></p>
      <p><strong>Motivo informado:</strong> ${reserva.motivo_decisao || 'Não informado'}</p>
    `;

  } else if (status === 'CANCELADA') {
    conteudo += `
      <p style="color:#a00000;"><strong>A solicitação foi CANCELADA.</strong></p>
      <p><strong>Motivo informado:</strong> ${reserva.motivo_decisao || 'Não informado'}</p>
    `;
  } else {
    conteudo += `
      <p>Status atualizado para: <strong>${status}</strong>.</p>
    `;
  }

  await enviarEmail({
    to: reserva.email,
    subject: `Atualização da solicitação – ${status} – Auditório CBMES`,
    html: layoutBase(conteudo),
  });
}

module.exports = {
  enviarEmailNovaReserva,
  enviarEmailDecisaoReserva,
};
