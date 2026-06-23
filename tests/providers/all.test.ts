import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getProvider } from '../../src/providers/index.ts';

describe('All providers registered', () => {
  it('sendgrid is registered', () => {
    assert.ok(getProvider('sendgrid'), 'sendgrid must be registered');
  });

  it('mailgun is registered', () => {
    assert.ok(getProvider('mailgun'), 'mailgun must be registered');
  });

  it('ses is registered', () => {
    assert.ok(getProvider('ses'), 'ses must be registered');
  });

  it('smtp is registered', () => {
    assert.ok(getProvider('smtp'), 'smtp must be registered');
  });

  it('brevo is registered', () => {
    assert.ok(getProvider('brevo'), 'brevo must be registered');
  });
});
