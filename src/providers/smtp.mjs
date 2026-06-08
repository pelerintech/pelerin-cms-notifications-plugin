/**
 * SMTP notification provider.
 *
 * Uses nodemailer for SMTP sending.
 * Auto-registers with the provider registry on import.
 */

import { registerProvider } from './registry.mjs';

function getSetting(key) {
  const envKey = key.toUpperCase().replace(/_/g, '_');
  return process.env[envKey];
}

const smtpProvider = {
  name: 'smtp',
  channels: ['email'],

  getConfigSchema() {
    return {
      requiredKeys: ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_tls'],
      fields: {
        smtp_host: {
          type: 'text',
          label: 'SMTP Host',
          description: 'SMTP server hostname (e.g., smtp.example.com)',
        },
        smtp_port: {
          type: 'number',
          label: 'SMTP Port',
          description: 'SMTP server port (e.g., 587 for STARTTLS, 465 for SSL)',
        },
        smtp_username: {
          type: 'text',
          label: 'Username',
          description: 'SMTP authentication username',
        },
        smtp_password: {
          type: 'password',
          label: 'Password',
          description: 'SMTP authentication password',
        },
        smtp_tls: {
          type: 'boolean',
          label: 'Use TLS',
          description: 'Enable TLS encryption for the connection',
        },
      },
    };
  },

  async send(params) {
    const host = getSetting('smtp_host');
    const port = parseInt(getSetting('smtp_port') || '587', 10);
    const username = getSetting('smtp_username');
    const password = getSetting('smtp_password');
    const useTls = getSetting('smtp_tls') === 'true';

    if (!host || !username || !password) {
      return { success: false, error: 'SMTP configuration incomplete' };
    }

    try {
      // Dynamic import of nodemailer — only loaded when SMTP is used
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        tls: useTls ? { rejectUnauthorized: true } : undefined,
        auth: {
          user: username,
          pass: password,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL || 'notifications@example.com',
        to: params.to.join(','),
        cc: params.cc?.join(','),
        bcc: params.bcc?.join(','),
        subject: params.subject,
        text: params.bodyText,
        html: params.bodyHtml,
      });

      return { success: true, messageId: info.messageId };
    } catch (err) {
      return { success: false, error: `SMTP request failed: ${err.message}` };
    }
  },
};

registerProvider(smtpProvider);

export { smtpProvider as smtp };
