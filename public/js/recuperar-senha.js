const formRecuperar = document.getElementById('formRecuperar');
const msg = document.getElementById('msg');

formRecuperar.addEventListener('submit', async (e) => {
  e.preventDefault();

  msg.style.display = 'none';

  const email = formRecuperar.email.value.trim();
  if (!email) {
    msg.textContent = 'Informe o e-mail de login.';
    msg.className = 'msg erro';
    msg.style.display = 'block';
    return;
  }

  try {
    const resp = await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    // Independente do resultado, a mensagem é sempre de sucesso
    msg.textContent = 'Se o e-mail estiver cadastrado, um link de redefinição foi enviado.';
    msg.className = 'msg ok';
    msg.style.display = 'block';
    formRecuperar.reset();
  } catch (err) {
    console.error(err);
    msg.textContent = 'Erro ao solicitar recuperação. Tente novamente.';
    msg.className = 'msg erro';
    msg.style.display = 'block';
  }
});

document.getElementById('btnVoltarLogin').addEventListener('click', () => {
  window.location.href = '/login.html';
});
