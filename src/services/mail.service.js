// src/services/mail.service.js
const nodemailer = require('nodemailer');

// Transporter usando Gmail
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // Usa STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function enviarEmail({ to, subject, html }) {
  try {
    if (!to) {
      console.warn('[MAILER] E-mail de destino vazio. Cancelando envio.');
      return;
    }

    console.log('[MAILER] Enviando e-mail via GMAIL SMTP...', { to, subject });

    const response = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER, 
      to,
      subject,
      html,
    });

    console.log('[MAILER] E-mail enviado com sucesso!', response.messageId);

    return response;
  } catch (err) {
    console.error('[MAILER] Erro ao enviar e-mail via GMAIL SMTP:', err);
    throw err;
  }
}

module.exports = { enviarEmail };
