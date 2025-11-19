const API_BASE = '/api';

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

function avaliarCondicoesCheckout() {
  // Perguntas de condição
  const q4 = document.querySelector('input[name="ambiente_entregue_limpo"]:checked')?.value;
  const q5 = document.querySelector('input[name="iluminacao_desligada"]:checked')?.value;
  const q6 = document.querySelector('input[name="climatizacao_desligada"]:checked')?.value;
  const q7 = document.querySelector('input[name="mobilia_igual_checkin"]:checked')?.value;
  const q8 = document.querySelector('input[name="danos_ocorridos"]:checked')?.value;

  const confSemAlt = document.getElementById('conf_sem_alteracoes');
  const confComAlt = document.getElementById('conf_com_alteracoes');

  // Se ainda não respondeu todas, não vamos travar nada
  if (!q4 || !q5 || !q6 || !q7 || !q8) {
    confSemAlt.disabled = false;
    confComAlt.disabled = false;
    return;
  }

  // Regra:
  // - "sem alterações" → q4,q5,q6,q7 = SIM e q8 = NAO
  // - "com alterações" → qualquer outra combinação
  const tudoOk =
    q4 === 'SIM' &&
    q5 === 'SIM' &&
    q6 === 'SIM' &&
    q7 === 'SIM' &&
    q8 === 'NAO';

  if (tudoOk) {
    // Só permite "sem alterações"
    confSemAlt.disabled = false;
    confComAlt.disabled = true;
    if (confComAlt.checked) confComAlt.checked = false;
    if (!confSemAlt.checked) confSemAlt.checked = true;
  } else {
    // Só permite "com alterações"
    confSemAlt.disabled = true;
    confComAlt.disabled = false;
    if (confSemAlt.checked) confSemAlt.checked = false;
    if (!confComAlt.checked) confComAlt.checked = true;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = getTokenFromUrl();

  const mensagemEl = document.getElementById('mensagem');
  const infoReservaEl = document.getElementById('infoReserva');
  const form = document.getElementById('formCheckout');
  const btnVoltarInicio = document.getElementById('btnVoltarInicio');

  btnVoltarInicio.addEventListener('click', () => {
    window.location.href = '/index.html';
  });

  if (!token) {
    mensagemEl.textContent = 'Link inválido. O token de acesso não foi informado.';
    mensagemEl.className = 'mensagem erro';
    mensagemEl.style.display = 'block';
    infoReservaEl.textContent = '';
    return;
  }

  // Carrega informações da reserva para CHECKOUT
  try {
    const resp = await fetch(`${API_BASE}/checklist/${token}?tipo=CHECKOUT`);
    const json = await resp.json();

    if (!resp.ok) {
      mensagemEl.textContent = json.error || 'Erro ao carregar informações da reserva.';
      mensagemEl.className = 'mensagem erro';
      mensagemEl.style.display = 'block';
      infoReservaEl.textContent = '';
      return;
    }

    const { reserva, podeResponder, motivoBloqueio, jaPreenchido } = json;

    const dataIni = reserva.data_evento.split('-').reverse().join('/');
    const dataFim = reserva.data_fim.split('-').reverse().join('/');

    infoReservaEl.textContent =
      `Reserva #${reserva.id} – ${reserva.instituicao} – responsável: ${reserva.responsavel} – ` +
      `Período do evento: ${dataIni} a ${dataFim}`;

    if (!podeResponder) {
      mensagemEl.textContent = motivoBloqueio || 'Este formulário não está disponível para preenchimento.';
      mensagemEl.className = 'mensagem erro';
      mensagemEl.style.display = 'block';
      form.style.display = 'none';
      return;
    }

    if (jaPreenchido) {
      mensagemEl.textContent = 'Este formulário de Check-OUT já foi preenchido.';
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

  // Escutar mudanças nas perguntas 4 a 8 para aplicar a regra de confirmação
  const radiosCondicao = document.querySelectorAll(
    'input[name="ambiente_entregue_limpo"], ' +
    'input[name="iluminacao_desligada"], ' +
    'input[name="climatizacao_desligada"], ' +
    'input[name="mobilia_igual_checkin"], ' +
    'input[name="danos_ocorridos"]'
  );

  radiosCondicao.forEach(r => {
    r.addEventListener('change', avaliarCondicoesCheckout);
  });

  // Envio do Check-OUT
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensagemEl.style.display = 'none';

    const email = document.getElementById('email_checkout').value.trim();
    const nome = document.getElementById('nome_responsavel_checkout').value.trim();
    const horaEncerramento = document.getElementById('hora_encerramento').value;
    const danos = document.querySelector('input[name="danos_ocorridos"]:checked')?.value;
    const danosObs = document.getElementById('danos_ocorridos_obs').value.trim();
    const confirmacao = document.querySelector('input[name="confirmacao_checkout"]:checked')?.value;

    if (!email || !nome || !horaEncerramento) {
      alert('Preencha todos os campos obrigatórios (e-mail, nome e horário de encerramento).');
      return;
    }

    if (!confirmacao) {
      alert('Selecione uma opção de confirmação de Check-OUT.');
      return;
    }

    // Observações obrigatórias se houve danos (pergunta 8 = SIM)
    if (danos === 'SIM' && !danosObs) {
      alert('Descreva os danos, problemas ou irregularidades identificados.');
      return;
    }

    // Monta payload
    const formData = new FormData(form);
    const payload = { tipo_checklist: 'CHECKOUT' };

    for (const [key, value] of formData.entries()) {
      payload[key] = value;
    }

    try {
      const resp = await fetch(`${API_BASE}/checklist/${token}?tipo=CHECKOUT`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await resp.json();

      if (!resp.ok) {
        mensagemEl.textContent = json.error || 'Erro ao enviar o Check-OUT.';
        mensagemEl.className = 'mensagem erro';
        mensagemEl.style.display = 'block';
        return;
      }

      mensagemEl.textContent = 'Check-OUT registrado com sucesso. Obrigado!';
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
