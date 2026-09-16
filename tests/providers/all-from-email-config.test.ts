import { describe, it } from 'node:test';
import assert from 'node:assert';
import { brevo } from '../../src/providers/brevo.ts';
import { sendgrid } from '../../src/providers/sendgrid.ts';
import { mailgun } from '../../src/providers/mailgun.ts';
import { smtp } from '../../src/providers/smtp.ts';
import { ses } from '../../src/providers/ses.ts';

const cases: [string, any, string][] = [
  ['brevo', brevo, 'brevo_from_email'],
  ['sendgrid', sendgrid, 'sendgrid_from_email'],
  ['mailgun', mailgun, 'mailgun_from_email'],
  ['smtp', smtp, 'smtp_from_email'],
  ['ses', ses, 'ses_from_email'],
];

describe('all providers declare a from-email settings field', () => {
  for (const [name, provider, key] of cases) {
    it(`${name} declares ${key} in requiredKeys`, () => {
      const schema = provider.getConfigSchema();
      assert.ok(schema.requiredKeys.includes(key), `${name} must require ${key} in requiredKeys`);
    });

    it(`${name} declares ${key} as a text field`, () => {
      const schema = provider.getConfigSchema();
      assert.ok(schema.fields && schema.fields[key], `${name} must declare ${key} in fields`);
      assert.strictEqual(schema.fields[key].type, 'text', `${name} ${key} must be type text`);
    });
  }
});
