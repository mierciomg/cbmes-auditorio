const form = document.getElementById('formAlterarSenha');
const msgErro = document.getElementById('msgErro');
const msgSucesso = document.getElementById('msgSucesso');

function mostrarErro(texto) {
    msgSucesso.style.display = 'none';
    msgErro.textContent = texto;
    msgErro.style.display = 'block';
}

function mostrarSucesso(texto) {
    msgErro.style.display = 'none';
    msgSucesso.textContent = texto;
    msgSucesso.style.display = 'block';
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const senhaAtual = form.senha_atual.value.trim();
    const novaSenha = form.nova_senha.value.trim();
    const confirma = document.getElementById('confirmaSenha').value.trim();

    if (!senhaAtual || !novaSenha || !confirma) {
        return mostrarErro('Preencha todos os campos.');
    }

    if (novaSenha.length < 6) {
        return mostrarErro('A nova senha deve ter pelo menos 6 caracteres.');
    }

    if (novaSenha !== confirma) {
        return mostrarErro('A confirmação da senha não confere com a nova senha.');
    }

    try {
        const resp = await fetch('/api/alterar-senha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senha_atual: senhaAtual,
                nova_senha: novaSenha,
            })
        });

        const json = await resp.json();

        if (!resp.ok || !json.ok) {
            return mostrarErro(json.error || 'Erro ao alterar senha.');
        }

        mostrarSucesso('Senha alterada com sucesso!');
        form.reset();
    } catch (err) {
        console.error(err);
        mostrarErro('Erro de comunicação com o servidor.');
    }
});

document.getElementById('btnVoltar').addEventListener('click', () => {
    window.location.href = '/index.html';
});

document.getElementById('btnPortalInterno').addEventListener('click', () => {
    window.location.href = '/admin.html';
});

