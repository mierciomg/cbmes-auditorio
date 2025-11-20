document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = '/api';

  const periodosPadrao = {
    INTEGRAL: 'Integral (08h às 18h)',
    MANHA: 'Manhã (08h às 12h)',
    TARDE: 'Tarde (13h às 17h)',
    NOITE: 'Noite (18h às 21h)'
  };

  let todasReservas = [];
  let usuarioLogado = null;
  let usuarioEmEdicaoId = null;

  // ===================== MODAL "EM USO DA CORPORAÇÃO" -> RESERVA =====================
  let reservaUsoSelecionada = null;
  let modalCarregado = false;

  // Backdrop/base do modal (container vazio em admin.html)
  const modalTransformarBackdrop = document.getElementById('modalTransformarUso');

  // Referências que serão preenchidas quando o HTML do modal for carregado
  let formTransformar = null;
  let tfTipo = null;
  let tfPeriodo = null;
  let tfInstituicao = null;
  let tfResponsavel = null;
  let tfTelefone = null;
  let tfEmail = null;
  let tfDataInicio = null;
  let tfDataFim = null;
  let tfFinalidade = null;
  let tfObservacoes = null;

  async function garantirModalCarregado() {
    if (modalCarregado) return;
    if (!modalTransformarBackdrop) {
      console.error('Container do modal não encontrado (#modalTransformarUso).');
      return;
    }

    try {
      const resp = await fetch('/modal-transformar.html');
      const html = await resp.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const card = doc.querySelector('.modal-card');
      if (!card) {
        console.error('Não encontrei .modal-card em modal-transformar.html');
        return;
      }

      modalTransformarBackdrop.innerHTML = '';
      modalTransformarBackdrop.appendChild(card);

      // Agora os elementos existem no DOM
      formTransformar = document.getElementById('formTransformarUso');
      tfTipo = document.getElementById('tf_tipo');
      tfPeriodo = document.getElementById('tf_periodo');
      tfInstituicao = document.getElementById('tf_instituicao');
      tfResponsavel = document.getElementById('tf_responsavel');
      tfTelefone = document.getElementById('tf_telefone');
      tfEmail = document.getElementById('tf_email');
      tfDataInicio = document.getElementById('tf_dataInicio');
      tfDataFim = document.getElementById('tf_dataFim');
      tfFinalidade = document.getElementById('tf_finalidade');
      tfObservacoes = document.getElementById('tf_observacoes');

      const btnCancelarTransformar = document.getElementById('btnCancelarTransformar');
      if (btnCancelarTransformar) {
        btnCancelarTransformar.addEventListener('click', () => {
          fecharModalTransformar();
        });
      }

      if (formTransformar) {
        formTransformar.addEventListener('submit', async e => {
          e.preventDefault();
          if (!reservaUsoSelecionada) return;

          const id = reservaUsoSelecionada.id;

          const payload = {
            tipo_solicitacao: tfTipo?.value,
            periodo: tfPeriodo?.value,
            instituicao: tfInstituicao?.value,
            responsavel: tfResponsavel?.value,
            telefone: tfTelefone?.value,
            email: tfEmail?.value,
            data_evento: tfDataInicio?.value,
            data_fim: tfDataFim?.value || tfDataInicio?.value,
            finalidade: tfFinalidade?.value,
            observacoes: tfObservacoes?.value
          };

          if (!payload.responsavel || !payload.finalidade) {
            alert('Responsável e finalidade são obrigatórios.');
            return;
          }

          try {
            const resp = await fetch(`${API_BASE}/reservas/${id}/transformar-uso`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            const resJson = await resp.json().catch(() => ({}));

            if (resp.status === 401) {
              alert('Sessão expirada. Faça login novamente.');
              window.location.href = '/login.html';
              return;
            }

            if (!resp.ok) {
              alert(resJson.error || 'Erro ao salvar alterações.');
              return;
            }

            alert('Reserva atualizada com sucesso!');
            fecharModalTransformar();
            carregarReservas();
          } catch (err) {
            console.error(err);
            alert('Erro de comunicação com o servidor. Tente novamente mais tarde.');
          }
        });
      }

      modalCarregado = true;
    } catch (erro) {
      console.error('Erro ao carregar modal-transformar.html:', erro);
    }
  }

  modalTransformarBackdrop.addEventListener('click', e => {
    if (e.target === modalTransformarBackdrop) {
      fecharModalTransformar();
    }
  });


  function fecharModalTransformar() {
    reservaUsoSelecionada = null;
    if (modalTransformarBackdrop) {
      modalTransformarBackdrop.style.display = 'none';
    }
    if (formTransformar) {
      formTransformar.reset();
    }
  }

  async function abrirModalTransformar(reserva) {
    await garantirModalCarregado();

    reservaUsoSelecionada = reserva;

    // Preenche campos normalmente
    if (tfTipo) tfTipo.value = (reserva.tipo_solicitacao || 'INTERNA').toUpperCase();
    if (tfPeriodo) tfPeriodo.value = (reserva.periodo || 'INTEGRAL').toUpperCase();
    if (tfInstituicao) tfInstituicao.value = reserva.instituicao || '';
    if (tfResponsavel) tfResponsavel.value = reserva.responsavel || '';
    if (tfTelefone) tfTelefone.value = reserva.telefone || '';
    if (tfEmail) tfEmail.value = reserva.email || '';
    if (tfDataInicio) tfDataInicio.value = reserva.data_evento?.substring(0, 10) || '';
    if (tfDataFim) tfDataFim.value = reserva.data_fim?.substring(0, 10) || tfDataInicio.value;
    if (tfFinalidade) {
      const valor = reserva.finalidade || '';

      // Se o valor existir na lista, seleciona
      if ([...tfFinalidade.options].some(o => o.value === valor)) {
        tfFinalidade.value = valor;
      } else {
        tfFinalidade.value = 'Outro';
      }
    }

    if (tfObservacoes) tfObservacoes.value = reserva.observacoes || '';

    // IMPORTANTÍSSIMO — remove o display none inline
    modalTransformarBackdrop.style.display = 'flex';

    // Ativa animação
    modalTransformarBackdrop.classList.add('show');
  }


  function fecharModalTransformar() {
    if (!modalTransformarBackdrop) return;

    modalTransformarBackdrop.classList.remove('show'); // ativa fade-out

    setTimeout(() => {
      modalTransformarBackdrop.style.display = 'none';
      if (formTransformar) formTransformar.reset();
      reservaUsoSelecionada = null;
    }, 250); // tempo igual da animação no CSS
  }



  // ===================== ELEMENTOS EXISTENTES DO PORTAL INTERNO =====================

  const infoUsuario = document.getElementById('infoUsuario');
  const btnLogout = document.getElementById('btnLogout');
  const btnAlterar = document.getElementById('btnAlterarSenha');
  const filtroTipo = document.getElementById('filtroTipo');
  const filtroStatus = document.getElementById('filtroStatus');

  // Aba CHECKLISTS – filtros
  const filtroIdReserva = document.getElementById('filtroIdReserva');
  const filtroTipoSolicitacaoChk = document.getElementById('filtroTipoSolicitacao');
  const filtroDataIni = document.getElementById('filtroDataIni');
  const filtroDataFim = document.getElementById('filtroDataFim');
  const filtroConcordouUso = document.getElementById('filtroConcordouUso');
  const filtroCheckoutAlteracoes = document.getElementById('filtroCheckoutAlteracoes');
  const btnBuscarChecklists = document.getElementById('btnBuscarChecklists');
  const btnLimparChecklists = document.getElementById('btnLimparChecklists');

  // Aba USUÁRIOS – formulário e tabela
  const usuarioNome = document.getElementById('usuarioNome');
  const usuarioEmail = document.getElementById('usuarioEmail');
  const usuarioSenha = document.getElementById('usuarioSenha');
  const usuarioAdmin = document.getElementById('usuarioAdmin');
  const usuarioAtivo = document.getElementById('usuarioAtivo');
  const btnSalvarUsuario = document.getElementById('btnSalvarUsuario');
  const btnNovoUsuario = document.getElementById('btnNovoUsuario');
  const tabelaUsuariosBody = document.getElementById('tabelaUsuariosBody');

  // Abas
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabSections = document.querySelectorAll('.tab-section');

  function formatarDataISO(iso) {
    if (!iso) return '';
    return iso.slice(0, 10).split('-').reverse().join('/');
  }

  function criarStatusPill(status) {
    const span = document.createElement('span');
    span.classList.add('status-pill');
    const st = (status || '').toUpperCase();

    if (st === 'PENDENTE') span.classList.add('st-pendente');
    if (st === 'APROVADA') span.classList.add('st-aprovada');
    if (st === 'NEGADA') span.classList.add('st-negada');
    if (st === 'CANCELADA') span.classList.add('st-cancelada');

    span.textContent = st || '---';
    return span;
  }

  // ===================== RESERVAS (ABA SOLICITAÇÕES) =====================

  function renderTabela() {
    const tbody = document.querySelector('#tabelaReservas tbody');
    tbody.innerHTML = '';

    if (!Array.isArray(todasReservas) || todasReservas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhuma solicitação registrada.</td></tr>';
      return;
    }

    const filtroTipoVal = filtroTipo ? filtroTipo.value : '';
    const filtroStatusVal = filtroStatus ? filtroStatus.value : '';

    const reservasFiltradas = todasReservas.filter(r => {
      const tipo = (r.tipo_solicitacao || '').toUpperCase();
      const st = (r.status || '').toUpperCase();

      if (filtroTipoVal && tipo !== filtroTipoVal) return false;
      if (filtroStatusVal && st !== filtroStatusVal) return false;

      return true;
    });

    if (reservasFiltradas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhuma solicitação com os filtros selecionados.</td></tr>';
      return;
    }

    reservasFiltradas.forEach(r => {
      const tr = document.createElement('tr');

      const tdId = document.createElement('td');
      tdId.textContent = r.id;

      const tdData = document.createElement('td');
      const periodoLabel = periodosPadrao[r.periodo] || r.periodo;
      const dataIni = formatarDataISO(r.data_evento);
      const dataFim = r.data_fim ? formatarDataISO(r.data_fim) : dataIni;
      const textoData = dataIni === dataFim ? dataIni : `${dataIni} a ${dataFim}`;
      tdData.innerHTML = `<strong>${textoData}</strong><br>${periodoLabel}`;

      const tdInst = document.createElement('td');
      const tipo = (r.tipo_solicitacao || '').toUpperCase();
      const rotuloTipo =
        tipo === 'INTERNA'
          ? 'Interna (CBMES)'
          : tipo === 'EXTERNA'
            ? 'Externa'
            : '—';
      tdInst.innerHTML = `
        <strong>${r.instituicao}</strong><br>
        <small>Tipo: ${rotuloTipo}</small><br>
        ${r.responsavel}<br>
        <small>${r.email}<br>${r.telefone}</small>
      `;

      const tdFinalidade = document.createElement('td');
      let textoFinal = `<strong>${r.finalidade}</strong>`;
      if (r.observacoes) {
        textoFinal += `<br><small>${r.observacoes}</small>`;
      }
      tdFinalidade.innerHTML = textoFinal;

      const tdAnexo = document.createElement('td');
      if (r.anexo_url) {
        const link = document.createElement('a');
        link.href = r.anexo_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Ver anexo';
        link.className = 'btn-link';
        tdAnexo.appendChild(link);
      } else {
        tdAnexo.innerHTML = '<span style="font-size:.7rem;color:#999;">—</span>';
      }

      const tdStatus = document.createElement('td');
      tdStatus.appendChild(criarStatusPill(r.status));

      if (r.analisado_por) {
        const small = document.createElement('div');
        small.style.fontSize = '.65rem';
        small.style.marginTop = '4px';

        let txt = `Por: ${r.analisado_por}`;
        if (r.analisado_email) {
          txt += ` (${r.analisado_email})`;
        }
        if (r.data_decisao) {
          txt += ` em ${formatarDataISO(r.data_decisao)}`;
        }

        small.textContent = txt;
        tdStatus.appendChild(small);
      }

      if (r.motivo_decisao) {
        const m = document.createElement('div');
        m.style.fontSize = '.65rem';
        m.style.marginTop = '2px';
        m.style.color = '#555';
        m.textContent = `Motivo: ${r.motivo_decisao}`;
        tdStatus.appendChild(m);
      }

      const tdAcoes = document.createElement('td');
      const statusUpper = (r.status || '').toUpperCase();
      const tipoUpper = (r.tipo_solicitacao || '').toUpperCase();
      const finalidadeUpper = (r.finalidade || '').toUpperCase();
      const obsUpper = (r.observacoes || '').toUpperCase();

      // "Em uso da Corporação": identificado pela finalidade ou observações
      // Normalize finalidade e observações
      const finalidadeNorm = (r.finalidade || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const obsNorm = (r.observacoes || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Detectar uso da corporação de forma segura
      const isUsoCorporacao =
        statusUpper === 'APROVADA' &&
        tipoUpper === 'INTERNA' &&
        (
          finalidadeNorm.includes('EM USO DA CORPORACAO') ||
          obsNorm.includes('EM USO DA CORPORACAO')
        );


      if (statusUpper === 'PENDENTE') {
        const btnAprovar = document.createElement('button');
        btnAprovar.className = 'btn btn-aprovar';
        btnAprovar.textContent = 'Aprovar';
        btnAprovar.addEventListener('click', () => atualizarStatus(r.id, 'APROVADA'));

        const btnNegar = document.createElement('button');
        btnNegar.className = 'btn btn-negar';
        btnNegar.textContent = 'Negar';
        btnNegar.addEventListener('click', () => atualizarStatus(r.id, 'NEGADA'));

        tdAcoes.appendChild(btnAprovar);
        tdAcoes.appendChild(btnNegar);
      } else if (statusUpper === 'APROVADA') {
        const btnCancelar = document.createElement('button');
        btnCancelar.className = 'btn btn-negar';
        btnCancelar.textContent = 'Cancelar';
        btnCancelar.addEventListener('click', () => atualizarStatus(r.id, 'CANCELADA'));
        tdAcoes.appendChild(btnCancelar);

        // Botão extra só para reservas "Em uso da Corporação"
        if (isUsoCorporacao) {
          const btnTransformar = document.createElement('button');
          btnTransformar.className = 'btn btn-aprovar btn-transformar-uso';
          btnTransformar.textContent = 'Transformar em reserva';
          btnTransformar.dataset.id = r.id;
          tdAcoes.appendChild(btnTransformar);
        }
      } else {
        tdAcoes.textContent = '-';
      }

      tr.appendChild(tdId);
      tr.appendChild(tdData);
      tr.appendChild(tdInst);
      tr.appendChild(tdFinalidade);
      tr.appendChild(tdAnexo);
      tr.appendChild(tdStatus);
      tr.appendChild(tdAcoes);

      tbody.appendChild(tr);
    });
  }

  async function carregarReservas() {
    const tbody = document.querySelector('#tabelaReservas tbody');
    tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';

    try {
      const resp = await fetch(`${API_BASE}/reservas`);
      if (resp.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      const reservas = await resp.json();
      todasReservas = Array.isArray(reservas)
        ? reservas.sort((a, b) => {
          const sa = (a.status || '').toUpperCase() === 'PENDENTE' ? 0 : 1;
          const sb = (b.status || '').toUpperCase() === 'PENDENTE' ? 0 : 1;
          return sa - sb;
        })
        : [];
      renderTabela();
    } catch (err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="7">Erro ao carregar dados.</td></tr>';
    }
  }

  async function atualizarStatus(id, novoStatus) {
    let motivo = '';
    const st = novoStatus.toUpperCase();
    let ocuparCorpo = false;

    // 1) Mensagem de motivo (já existia)
    if (st === 'NEGADA' || st === 'CANCELADA') {
      const textoAcao = st === 'NEGADA' ? 'negativa' : 'cancelamento';
      const msgObrigatorio = st === 'NEGADA'
        ? 'Para negar uma solicitação é obrigatório informar o motivo.'
        : 'Para cancelar uma reserva é obrigatório informar o motivo.';

      while (true) {
        const resposta = prompt(
          `Informe o motivo da ${textoAcao} (será registrado na base):`
        );
        if (resposta === null) return; // cancelou
        if (resposta.trim() === '') {
          alert(msgObrigatorio);
          continue;
        }
        motivo = resposta.trim();
        break;
      }
    }

    // 2) Só se for NEGADA, pergunta se quer bloquear como "uso da corporação"
    if (st === 'NEGADA') {
      const respOcupar = confirm(
        'Deseja marcar esta data/período como "Em uso da Corporação" no calendário público?'
      );
      ocuparCorpo = respOcupar === true;
    }

    // 3) Confirma alteração de status
    if (!confirm(`Confirma alterar o status da reserva ${id} para ${st}?`)) {
      return;
    }

    // 4) Chama API
    try {
      const resp = await fetch(`${API_BASE}/reservas/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: st,
          motivo_decisao: motivo,
          ocupar_corporacao: ocuparCorpo
        })
      });

      const resJson = await resp.json();

      if (resp.status === 401) {
        alert('Sessão expirada. Faça login novamente.');
        window.location.href = '/login.html';
        return;
      }

      if (!resp.ok) {
        alert(resJson.error || 'Erro ao atualizar status da reserva.');
        return;
      }

      alert('Status atualizado com sucesso!');
      carregarReservas();
    } catch (err) {
      console.error(err);
      alert('Erro de comunicação com o servidor.');
    }
  }

  // ===================== CHECKLISTS (ABA CHECKLISTS) =====================

  async function buscarChecklists() {
    const tbody = document.getElementById('tabelaChecklistsBody');
    if (!tbody) return;

    const params = new URLSearchParams();

    if (filtroIdReserva && filtroIdReserva.value.trim()) {
      params.append('id', filtroIdReserva.value.trim());
    }
    if (filtroTipoSolicitacaoChk && filtroTipoSolicitacaoChk.value) {
      params.append('tipo_solicitacao', filtroTipoSolicitacaoChk.value);
    }
    if (filtroDataIni && filtroDataIni.value) {
      params.append('data_ini', filtroDataIni.value);
    }
    if (filtroDataFim && filtroDataFim.value) {
      params.append('data_fim', filtroDataFim.value);
    }
    if (filtroConcordouUso && filtroConcordouUso.value) {
      params.append('concordou_uso', filtroConcordouUso.value);
    }
    if (filtroCheckoutAlteracoes && filtroCheckoutAlteracoes.value) {
      params.append('checkout_alteracoes', filtroCheckoutAlteracoes.value);
    }

    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align:center;font-size:.85rem;color:#666;">
          Carregando...
        </td>
      </tr>
    `;

    try {
      const url = `${API_BASE}/reservas/checklists?${params.toString()}`;
      const resp = await fetch(url);

      if (resp.status === 401) {
        window.location.href = '/login.html';
        return;
      }

      const dados = await resp.json();

      if (!resp.ok) {
        tbody.innerHTML = `
          <tr>
            <td colspan="11" style="text-align:center;font-size:.85rem;color:#a00;">
              ${dados.error || 'Erro ao carregar dados.'}
            </td>
          </tr>
        `;
        return;
      }

      if (!Array.isArray(dados) || dados.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="11" style="text-align:center;font-size:.85rem;color:#666;">
              Nenhum registro encontrado para os filtros informados.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = '';

      dados.forEach(item => {
        const tr = document.createElement('tr');

        const dataIniStr = formatarDataISO(item.data_evento);
        const dataFimStr = formatarDataISO(item.data_fim);

        const checkinStatus = item.checkin_feito
          ? item.checklist_preenchido_em
            ? new Date(item.checklist_preenchido_em).toLocaleString('pt-BR')
            : 'Sim'
          : 'Não';

        const checkoutStatus = item.checkout_feito
          ? item.checklist_checkout_preenchido_em
            ? new Date(item.checklist_checkout_preenchido_em).toLocaleString('pt-BR')
            : 'Sim'
          : 'Não';

        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${dataIniStr}</td>
          <td>${dataFimStr}</td>
          <td>${item.tipo_solicitacao || ''}</td>
          <td>${item.periodo || ''}</td>
          <td>${item.instituicao || ''}</td>
          <td>${item.responsavel || ''}</td>
          <td>${checkinStatus}</td>
          <td>${item.concordou_uso ? 'Sim' : 'Não'}</td>
          <td>${checkoutStatus}</td>
          <td>${item.checkout_com_alteracoes ? 'Sim' : 'Não'}</td>
        `;

        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align:center;font-size:.85rem;color:#a00;">
            Erro de comunicação com o servidor.
          </td>
        </tr>
      `;
    }
  }

  function limparFiltrosChecklists() {
    if (filtroIdReserva) filtroIdReserva.value = '';
    if (filtroTipoSolicitacaoChk) filtroTipoSolicitacaoChk.value = '';
    if (filtroDataIni) filtroDataIni.value = '';
    if (filtroDataFim) filtroDataFim.value = '';
    if (filtroConcordouUso) filtroConcordouUso.value = '';
    if (filtroCheckoutAlteracoes) filtroCheckoutAlteracoes.value = '';

    const tbody = document.getElementById('tabelaChecklistsBody');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align:center;font-size:.85rem;color:#666;">
          Use os filtros acima e clique em "Buscar" para listar os registros.
        </td>
      </tr>
    `;
  }

  // ===================== USUÁRIOS (ABA USUÁRIOS) =====================

  function limparFormularioUsuario() {
    usuarioEmEdicaoId = null;
    if (usuarioNome) usuarioNome.value = '';
    if (usuarioEmail) usuarioEmail.value = '';
    if (usuarioSenha) usuarioSenha.value = '';
    if (usuarioAdmin) usuarioAdmin.checked = false;
    if (usuarioAtivo) usuarioAtivo.checked = true;
  }

  async function carregarUsuarios() {
    if (!tabelaUsuariosBody) return;

    tabelaUsuariosBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;font-size:.85rem;color:#666;">
          Carregando...
        </td>
      </tr>
    `;

    try {
      const resp = await fetch('/api/usuarios');
      if (resp.status === 403) {
        tabelaUsuariosBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center;font-size:.85rem;color:#a00;">
              Acesso restrito a administradores.
            </td>
          </tr>
        `;
        return;
      }
      if (!resp.ok) {
        tabelaUsuariosBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center;font-size:.85rem;color:#a00;">
              Erro ao carregar usuários.
            </td>
          </tr>
        `;
        return;
      }

      const usuarios = await resp.json();

      if (!Array.isArray(usuarios) || usuarios.length === 0) {
        tabelaUsuariosBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center;font-size:.85rem;color:#666;">
              Nenhum usuário cadastrado.
            </td>
          </tr>
        `;
        return;
      }

      tabelaUsuariosBody.innerHTML = '';

      usuarios.forEach(u => {
        const tr = document.createElement('tr');

        const escopo = (u.tipo_escopo || u.escopo || 'AMBOS')
          .replace('INTERNA', 'Interna')
          .replace('EXTERNA', 'Externa')
          .replace('AMBOS', 'Ambos');

        tr.innerHTML = `
          <td>${u.id}</td>
          <td>${u.nome}</td>
          <td>${u.email_login}</td>
          <td>${escopo}</td>
          <td>${u.is_admin ? 'Sim' : 'Não'}</td>
          <td>${u.ativo ? 'Ativo' : 'Inativo'}</td>
          <td>
            <button class="btn btn-aprovar btn-editar-usuario" data-id="${u.id}">Editar</button>
            <button class="btn btn-negar btn-toggle-ativo" data-id="${u.id}">
              ${u.ativo ? 'Inativar' : 'Ativar'}
            </button>
          </td>
        `;
        tabelaUsuariosBody.appendChild(tr);
      });

      // Eventos dos botões
      tabelaUsuariosBody.querySelectorAll('.btn-editar-usuario').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const u = usuarios.find(x => String(x.id) === String(id));
          if (!u) return;

          usuarioEmEdicaoId = u.id;
          if (usuarioNome) usuarioNome.value = u.nome || '';
          if (usuarioEmail) usuarioEmail.value = u.email_login || '';
          if (usuarioSenha) usuarioSenha.value = '';
          if (usuarioAdmin) usuarioAdmin.checked = !!u.is_admin;
          if (usuarioAtivo) usuarioAtivo.checked = !!u.ativo;

          const campoEscopo = document.getElementById('userEscopo');
          if (campoEscopo) {
            campoEscopo.value = u.tipo_escopo || 'AMBOS';
          }
        });
      });

      tabelaUsuariosBody.querySelectorAll('.btn-toggle-ativo').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const u = usuarios.find(x => String(x.id) === String(id));
          if (!u) return;

          const novaSituacao = !u.ativo;
          if (
            !confirm(
              `Confirmar ${novaSituacao ? 'ativação' : 'inativação'} do usuário ${u.nome}?`
            )
          ) {
            return;
          }

          await salvarUsuarioToggleAtivo(u.id, novaSituacao);
        });
      });
    } catch (err) {
      console.error(err);
      tabelaUsuariosBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;font-size:.85rem;color:#a00;">
            Erro de comunicação com o servidor.
          </td>
        </tr>
      `;
    }
  }

  async function salvarUsuarioToggleAtivo(id, novoAtivo) {
    try {
      const resp = await fetch(`/api/usuarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: novoAtivo })
      });

      const resJson = await resp.json();
      if (!resp.ok) {
        alert(resJson.error || 'Erro ao atualizar usuário.');
        return;
      }

      await carregarUsuarios();
    } catch (err) {
      console.error(err);
      alert('Erro de comunicação com o servidor.');
    }
  }

  async function salvarUsuario() {
    if (!usuarioNome || !usuarioEmail || !usuarioAtivo || !usuarioAdmin) return;

    const nome = usuarioNome.value.trim();
    const email_login = usuarioEmail.value.trim();
    const senha = usuarioSenha ? usuarioSenha.value : '';
    const is_admin = !!usuarioAdmin.checked;
    const ativo = !!usuarioAtivo.checked;
    const campoEscopo = document.getElementById('userEscopo');
    const tipo_escopo = campoEscopo ? campoEscopo.value : 'AMBOS';

    const emEdicao = !!usuarioEmEdicaoId;

    let url;
    let method;
    let payload;

    if (!emEdicao) {
      // criação
      if (!nome || !email_login || !senha) {
        alert('Nome, e-mail e senha são obrigatórios para criar um usuário.');
        return;
      }

      url = '/api/usuarios';
      method = 'POST';
      payload = { nome, email_login, senha, is_admin, ativo, tipo_escopo };
    } else {
      // edição
      url = `/api/usuarios/${usuarioEmEdicaoId}`;
      method = 'PATCH';
      payload = {
        nome,
        email_login,
        is_admin,
        ativo,
        tipo_escopo
      };
      if (senha && senha.trim() !== '') {
        payload.nova_senha = senha.trim();
      }
    }

    try {
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await resp.json();
      if (!resp.ok) {
        alert(resJson.error || 'Erro ao salvar usuário.');
        return;
      }

      alert('Usuário salvo com sucesso.');
      limparFormularioUsuario();
      await carregarUsuarios();
    } catch (err) {
      console.error(err);
      alert('Erro de comunicação com o servidor.');
    }
  }

  // ===================== INIT (LOGIN + EVENTOS) =====================

  (async function init() {
    try {
      const resp = await fetch('/api/me');
      if (resp.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      const user = await resp.json();
      usuarioLogado = user;

      if (infoUsuario) {
        infoUsuario.textContent =
          `Você está logado como: ${user.nome} (${user.email})` +
          (user.admin ? ' [ADMIN]' : '');
      }

      // Se não for admin, esconde a aba de usuários
      const abaUsuariosBtn = document.querySelector(
        '.tab-btn[data-target="secUsuarios"]'
      );
      if (abaUsuariosBtn && !user.admin) {
        abaUsuariosBtn.style.display = 'none';
      }

      await carregarReservas();
    } catch (err) {
      console.error('Erro ao verificar login', err);
      alert('Erro ao verificar usuário logado. Você será redirecionado.');
      window.location.href = '/login.html';
    }
  })();

  // Clique no botão "Transformar em reserva" (linhas em azul "Em uso da Corporação")
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-transformar-uso');
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const reserva = todasReservas.find(r => Number(r.id) === id);
    if (!reserva) {
      alert('Não foi possível localizar os dados da reserva selecionada.');
      return;
    }

    abrirModalTransformar(reserva);
  });

  // Filtros da aba Solicitações
  if (filtroTipo) filtroTipo.addEventListener('change', renderTabela);
  if (filtroStatus) filtroStatus.addEventListener('change', renderTabela);

  if (btnAlterar) {
    btnAlterar.addEventListener('click', () => {
      window.location.href = '/alterar-senha.html';
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch('/api/logout', { method: 'POST' });
      } catch (_) { }
      window.location.href = '/login.html';
    });
  }

  // Botões da aba Checklists
  if (btnBuscarChecklists) {
    btnBuscarChecklists.addEventListener('click', buscarChecklists);
  }
  if (btnLimparChecklists) {
    btnLimparChecklists.addEventListener('click', limparFiltrosChecklists);
  }

  // Botões da aba Usuários
  if (btnSalvarUsuario) {
    btnSalvarUsuario.addEventListener('click', salvarUsuario);
  }
  if (btnNovoUsuario) {
    btnNovoUsuario.addEventListener('click', () => {
      limparFormularioUsuario();
    });
  }

  // Lógica das abas
  if (tabButtons && tabButtons.length > 0) {
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const alvo = btn.dataset.target;

        tabButtons.forEach(b => b.classList.remove('active'));
        tabSections.forEach(sec => sec.classList.remove('active'));

        btn.classList.add('active');
        const sec = document.getElementById(alvo);
        if (sec) sec.classList.add('active');

        // Quando for aba de usuários, carrega lista (se admin)
        if (alvo === 'secUsuarios' && usuarioLogado && usuarioLogado.admin) {
          carregarUsuarios();
        }
      });
    });
  }
});
