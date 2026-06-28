import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';

// Every Tier 1-3 test file in the suite. Paths are passed as an argv array
// (not through a shell). NOTE: dynamic-route test files use bare param names
// (e.g. 'tests/api/handlers/rules/id.test.ts') — NOT '[id]' — because
// `node --test` treats '[' / ']' as a glob character class and silently skips
// such files (0 tests registered). The guard in
// tests/api/no-bracket-paths.test.ts enforces this.
//
// This list deliberately EXCLUDES `tests/full-suite.test.ts` itself to avoid
// infinite recursion (the child would rediscover and re-run this wrapper).
// Regenerate with: find tests -name '*.test.ts' -not -name 'full-suite.test.ts' | sort
const TEST_FILES: string[] = [
  'tests/api/handlers/logs/id.test.ts',
  'tests/api/handlers/logs/index.test.ts',
  'tests/api/handlers/providers/settings.test.ts',
  'tests/api/handlers/rules/create.test.ts',
  'tests/api/handlers/rules/id.test.ts',
  'tests/api/handlers/rules/index.test.ts',
  'tests/api/handlers/rules/providers.test.ts',
  'tests/api/handlers/templates/create.test.ts',
  'tests/api/handlers/templates/id.test.ts',
  'tests/api/handlers/templates/index.test.ts',
  'tests/api/no-bracket-paths.test.ts',
  'tests/db/harness-channel.test.ts',
  'tests/db/harness.test.ts',
  'tests/db/schema-parity.test.ts',
  'tests/deps-resolve.test.ts',
  'tests/deps-ses.test.ts',
  'tests/dev-mode.test.ts',
  'tests/dispatch/dispatch-credentials.test.ts',
  'tests/dispatch/dispatch-ses.test.ts',
  'tests/dispatch/dispatch.test.ts',
  'tests/dispatch/init.test.ts',
  'tests/infra/handler-types.test.ts',
  'tests/infra/helpers.test.ts',
  'tests/infra/loader.test.ts',
  'tests/infra/matrix.test.ts',
  'tests/interpolation.test.ts',
  'tests/lib/crypto.test.ts',
  'tests/lib/data/index.test.ts',
  'tests/lib/data/logs.test.ts',
  'tests/lib/data/provider-configured.test.ts',
  'tests/lib/data/rules-create-channel.test.ts',
  'tests/lib/data/rules-update-channel.test.ts',
  'tests/lib/data/rules.test.ts',
  'tests/lib/data/settings.test.ts',
  'tests/lib/data/templates.test.ts',
  'tests/local-provider.test.ts',
  'tests/matcher.test.ts',
  'tests/pages/admin-logs-index-script-syntax.test.ts',
  'tests/pages/admin-providers-name-script-syntax.test.ts',
  'tests/pages/admin-rules-id-script-syntax.test.ts',
  'tests/pages/admin-rules-index-script-syntax.test.ts',
  'tests/pages/admin-templates-id-script-syntax.test.ts',
  'tests/pages/admin-templates-index-script-syntax.test.ts',
  'tests/providers/all.test.ts',
  'tests/providers/brevo.test.ts',
  'tests/providers/credentials.test.ts',
  'tests/providers/list-objects.test.ts',
  'tests/providers/mailgun.test.ts',
  'tests/providers/sendgrid.test.ts',
  'tests/providers/ses-send.test.ts',
  'tests/providers/smtp.test.ts',
  'tests/registry.test.ts',
  'tests/rule-lookup.test.ts',
  'tests/schema.test.ts',
  'tests/schemas/rule-schema-channel.test.ts',
  'tests/schemas/schemas.test.ts',
];


test('full test suite passes (node --test <all test files>)', () => {
  // CRITICAL: strip NODE_TEST_CONTEXT / NODE_TEST_WORKER_ID from the child env.
  // `node --test` sets these on its own process; if the child `node --test`
  // inherits them it runs as a nested test worker — producing NO reporter
  // output and registering 0 tests while still exiting 0. That makes this suite
  // a silent false green. A clean env forces the child to run as a real
  // top-level test runner.
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  delete childEnv.NODE_TEST_WORKER_ID;
  let output = '';
  try {
    output = execFileSync('node', ['--test', ...TEST_FILES], {
      encoding: 'utf-8',
      timeout: 180000,
      stdio: 'pipe',
      env: childEnv,
    });
  } catch (err: any) {
    output = err.stdout || err.stderr || '';
    assert.fail(`Test suite failed:\n${output.slice(-2500)}`);
  }
  // Guard against silent false greens: confirm the child actually registered
  // real tests. If this assertion ever fires, the child is skipping every file
  // (glob-bracket paths, env inheritance, or a loader regression).
  const testsLine = output.split('\n').find((l) => /^# tests /.test(l)) ||
    output.split('\n').find((l) => /^ℹ tests /.test(l)) || '';
  const m = testsLine.match(/(\d+)/);
  const testCount = m ? parseInt(m[1], 10) : 0;
  assert.ok(
    testCount >= 270,
    `child node --test registered only ${testCount} tests — expected >=250; possible silent skip. Output tail:\n${output.slice(-1500)}`,
  );
});
