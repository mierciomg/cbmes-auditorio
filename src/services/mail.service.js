// src/services/mail.service.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,                  // smtp.gmail.com
  port: Number(process.env.MAIL_PORT || 465),   // 465 ou 587
  secure:
    process.env.MAIL_SECURE === 'true' ||
    process.env.MAIL_PORT === '465',            // SSL automático para porta 465
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

async function enviarEmail({ to, subject, html }) {
  const from = process.env.MAIL_FROM || process.env.MAIL_USER;

  console.log('[MAILER] Enviando e-mail...', { to, subject });

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
  });

  console.log('[MAILER] Resultado do envio:', {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  });

  return info;
}

module.exports = {
  enviarEmail,
};
