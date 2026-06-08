import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('All providers registered', () => {
  it('sendgrid is registered', async () => {
    const { getProvider } = await import('../../src/providers/index.mjs');
    assert.ok(getProvider('sendgrid'), 'sendgrid must be registered');
  });

  it('mailgun is registered', async () => {
    const { getProvider } = await import('../../src/providers/index.mjs');
    assert.ok(getProvider('mailgun'), 'mailgun must be registered');
  });

  it('ses is registered', async () => {
    const { getProvider } = await import('../../src/providers/index.mjs');
    assert.ok(getProvider('ses'), 'ses must be registered');
  });

  it('smtp is registered', async () => {
    const { getProvider } = await import('../../src/providers/index.mjs');
    assert.ok(getProvider('smtp'), 'smtp must be registered');
  });

  it('brevo is registered', async () => {
    const { getProvider } = await import('../../src/providers/index.mjs');
    assert.ok(getProvider('brevo'), 'brevo must be registered');
  });
});
