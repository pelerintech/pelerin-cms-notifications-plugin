import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

test('interface send() declares a second parameter typed LibSQLDatabase', () => {
  const src = readFileSync(new URL('../../src/providers/interface.ts', import.meta.url), 'utf-8');
  // structural: the send declaration must accept db as a second param
  assert.ok(
    /send\s*\(\s*params\s*:\s*SendParams\s*,\s*db\s*:\s*LibSQLDatabase\b/.test(src),
    'send must be declared as send(params: SendParams, db: LibSQLDatabase ...)',
  );
});

test('interface.ts imports LibSQLDatabase type from drizzle-orm/libsql', () => {
  const src = readFileSync(new URL('../../src/providers/interface.ts', import.meta.url), 'utf-8');
  assert.ok(
    /import\s+type\s+\{[^}]*\bLibSQLDatabase\b[^}]*\}\s+from\s+['"]drizzle-orm\/libsql['"]/.test(src),
    'must import LibSQLDatabase from drizzle-orm/libsql',
  );
});
