import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf-8');
const section12 = src.split('## 12')[1] || '';

test('§12 states providers read decrypted credentials from the settings table (NOT process.env)', () => {
  assert.ok(/notification_settings/.test(section12), 'must mention notification_settings');
  assert.ok(/settings\.ts/.test(section12), 'must mention the settings.ts accessor');
  assert.ok(/crypto/.test(section12), 'must mention crypto');
  assert.ok(/AES-256-GCM|AES.256.GCM/i.test(section12), 'must mention AES-256-GCM');
  // providers must NOT be described as reading process.env for credentials
  assert.ok(
    !/Providers read `process\.env` only/i.test(section12) &&
      !/reads `process\.env` only/i.test(section12),
    'must not state providers read process.env only',
  );
});

test('§12 states the settings endpoint uses real crypto + requireAdmin (no base64 toy, no Map)', () => {
  assert.ok(/requireAdmin/.test(section12), 'must mention requireAdmin');
  // must not describe the toy crypto / Map as CURRENT behavior (mentioning them as deleted is fine)
  assert.ok(!/uses base64|uses an in-memory/i.test(section12), 'must not describe base64/Map as current usage');
  assert.ok(/deleted|removed|have been/i.test(section12), 'must state the toy crypto/Map were removed');
});

test('§12 states settings.ts accessor is now used (no longer unused)', () => {
  assert.ok(
    !/accessor exists and is tested but unused/i.test(section12) &&
      !/Nobody calls it yet/i.test(section12),
    'must not describe settings.ts accessor as unused',
  );
});

test('§12: the ONLY remaining gap is SES send() (placeholder, deferred to next request)', () => {
  assert.ok(/SES.*placeholder|SES.*send\(\)/i.test(section12), 'must note SES send() is the remaining gap');
  assert.ok(/deferred|follow-up|next request/i.test(section12), 'must reference deferral to next request');
});

test('AGENTS.md documents NOTIFICATIONS_ENCRYPTION_KEY as required (no default, throws if absent)', () => {
  assert.ok(/NOTIFICATIONS_ENCRYPTION_KEY/.test(src), 'must document the env var');
  assert.ok(
    /required env var|throws if absent|no default/i.test(src),
    'must state it is required with no default / throws if absent',
  );
});

test('provider interface section documents send(params, db) with db: LibSQLDatabase as second parameter', () => {
  assert.ok(
    /send\s*\(\s*params\s*,\s*db\s*\)/.test(src) || /send\(params, db\)/.test(src),
    'must document send(params, db)',
  );
  assert.ok(/LibSQLDatabase/.test(src), 'must reference LibSQLDatabase type for db param');
});
