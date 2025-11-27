// public/js/checklist.js
const API_BASE = '/api';

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = getTokenFromUrl();

  const mensagemEl = document.getElementById('mensagem');
  const infoReservaEl = document.getElementById('infoReserva');
  const form = document.getElementById('formChecklist');
  const btnVoltarInicio = document.getElementById('btnVoltarInicio');

  const chkConcordo = document.getElementById('concordo_uso');
  const chkNaoConcordo = document.getElementById('nao_concordo_uso');

  // Botão "Voltar"
  btnVoltarInicio.addEventListener('click', () => {
    window.location.href = '/index.html';
  });

  // Checkboxes mutuamente exclusivos (visual de checkbox, comportamento de rádio)
  chkConcordo.addEventListener('change', () => {
    if (chkConcordo.checked) chkNaoConcordo.checked = false;
  });

  chkNaoConcordo.addEventListener('change', () => {
    if (chkNaoConcordo.checked) chkConcordo.checked = false;
  });

  // Se não tiver token → erro
  if (!token) {
    mensagemEl.textContent = 'Link inválido. O token de acesso não foi informado.';
    mensagemEl.className = 'mensagem erro';
    mensagemEl.style.display = 'block';
    infoReservaEl.textContent = '';
    return;
  }

  // ================= CARREGA DADOS DA RESERVA (CHECK-IN) =================
  try {
    const resp = await fetch(`${API_BASE}/checklist/${token}?tipo=CHECKIN`);
    const json = await resp.json();

    if (!resp.ok) {
      mensagemEl.textContent = json.error || 'Erro ao carregar informações da reserva.';
      mensagemEl.className = 'mensagem erro';
      mensagemEl.style.display = 'block';
      infoReservaEl.textContent = '';
      return;
    }

    const { reserva, podeResponder, motivoBloqueio, jaPreenchido } = json;

    const dataFormatada = reserva.data_evento.split('-').reverse().join('/');
    infoReservaEl.textContent =
      `Reserva #${reserva.id} – ${reserva.instituicao} – responsável: ${reserva.responsavel} – ` +
      `Data do evento: ${dataFormatada}`;

    if (!podeResponder) {
      mensagemEl.textContent =
        motivoBloqueio || 'Este formulário não está disponível para preenchimento.';
      mensagemEl.className = 'mensagem erro';
      mensagemEl.style.display = 'block';
      form.style.display = 'none';
      return;
    }

    if (jaPreenchido) {
      mensagemEl.textContent = 'Este formulário de Check-IN já foi preenchido.';
      mensagemEl.className = 'mensagem ok';
      mensagemEl.style.display = 'block';
      form.style.display = 'none';
      return;
    }

    // Tudo certo → exibe o formulário
    form.style.display = 'grid';
  } catch (err) {
    console.error(err);
    mensagemEl.textContent = 'Erro de comunicação com o servidor.';
    mensagemEl.className = 'mensagem erro';
    mensagemEl.style.display = 'block';
    infoReservaEl.textContent = '';
    return;
  }

  // ================= ENVIO DO FORMULÁRIO (CHECK-IN) =================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensagemEl.style.display = 'none';

    const emailPreench = document.getElementById('email_preenchedor').value.trim();
    const nomeResp = document.getElementById('nome_responsavel_checkin').value.trim();
    if (!emailPreench || !nomeResp) {
      alert('Preencha todos os campos obrigatórios (e-mail e nome).');
      return;
    }


    if (!chkConcordo.checked) {
      alert(
        'Para confirmar o Check-IN é necessário marcar "Concordo com as condições de uso do auditório".'
      );
      return;
    }

    if (chkNaoConcordo.checked) {
      alert(
        'Não é possível confirmar o Check-IN marcando "Não concordo com as condições de uso do auditório".'
      );
      return;
    }

    // Monta o payload com TODAS as respostas do formulário
    const formData = new FormData(form);
    const payload = { tipo_checklist: 'CHECKIN' };

    for (const [key, value] of formData.entries()) {
      payload[key] = value;
    }

    payload.concordou_uso = chkConcordo.checked; // true se marcado, false se não

    // (Importante: aqui vai o campo concordo_uso = "on" quando marcado)

    try {
      const resp = await fetch(`${API_BASE}/checklist/${token}?tipo=CHECKIN`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await resp.json();

      if (!resp.ok) {
        mensagemEl.textContent = json.error || 'Erro ao enviar o checklist.';
        mensagemEl.className = 'mensagem erro';
        mensagemEl.style.display = 'block';
        return;
      }

      mensagemEl.textContent = 'Check-IN registrado com sucesso. Obrigado!';
      mensagemEl.className = 'mensagem ok';
      mensagemEl.style.display = 'block';
      form.style.display = 'none';
    } catch (err) {
      console.error(err);
      mensagemEl.textContent = 'Erro de comunicação com o servidor.';
      mensagemEl.className = 'mensagem erro';
      mensagemEl.style.display = 'block';
    }
  });
});
