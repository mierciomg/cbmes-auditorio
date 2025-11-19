document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;

    const data = {
        email: form.email.value,
        senha: form.senha.value,
    };

    const msgErro = document.getElementById('msgErro');
    msgErro.style.display = 'none';

    try {
        const resp = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const json = await resp.json();

        if (!resp.ok) {
            msgErro.textContent = json.error || 'Erro ao efetuar login.';
            msgErro.style.display = 'block';
            return;
        }

        window.location.href = '/admin.html';
    } catch (err) {
        console.error(err);
        msgErro.textContent = 'Erro de comunicação com o servidor.';
        msgErro.style.display = 'block';
    }
});

document.getElementById('btnEsqueci').addEventListener('click', () => {
    window.location.href = '/recuperar-senha.html';
});

document.getElementById('btnVoltar').addEventListener('click', () => {
    window.location.href = '/index.html';
});

