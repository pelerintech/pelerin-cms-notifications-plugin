# AGENTS.md — pelerin_notifications

This document is the single source of truth for AI agents working on the `pelerin_notifications` plugin. Read it in full before modifying code.

---

## 1. What this project is

`pelerin_notifications` is a **Pelerin CMS plugin**. It does not run standalone. It is cloned into the CMS's `plugins/pelerin_notifications/` directory and loaded at build time by Pelerin's plugin system.

The CMS repo lives at `../pelerin_cms/`. The sibling `../ecomm_plugin/` is the reference implementation for the data-access pattern this plugin follows.

---

## 2. Plugin overview

The plugin subscribes to CMS events on the event bus and dispatches notifications (email in v1) via a provider registry. Rules map event patterns to templates and providers. Every dispatch attempt is logged for audit and testing.

**Core entities:**

- **Rules** — `(event_pattern, template_id, provider_name)` triplets with recipient fields (to/cc/bcc). Unique on the triple.
- **Templates** — subject + body (HTML/text) with `{{ field }}` interpolation.
- **Logs** — audit trail of every dispatch attempt (success/failure, full content).
- **Settings** — key/value store for provider credentials (encrypted in the follow-up request; currently uses placeholder crypto).

---

## 3. Database (`src/db/schema.ts`)

`src/db/schema.ts` is the sole schema definition. It uses pure Drizzle (`sqliteTable` from `drizzle-orm/sqlite-core`). The CMS loads it via the manifest's `dbConfig` and merges the table exports at build time. Data accessors in `src/lib/data/` import table objects from this file, so they are importable and executable in the test harness outside Astro.

The `dateType` custom type (TEXT ISO, stored as ISO 8601 string) is used for all timestamp columns.

---

## 4. Data access layer (`src/lib/data/`) — mandatory pattern

**All database access must live in `src/lib/data/` as pure functions that receive `db` as the first parameter.** API endpoints, pages, and `init.ts` must NOT write queries inline — they call accessor functions and pass the `db` handle.

```
src/lib/data/
├── index.ts         (barrel re-exports)
├── rules.ts         (listRules, getRule, createRule, updateRule, deleteRule, findActiveRulesMatching)
├── templates.ts     (listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate)
├── logs.ts          (listLogs, getLog, createLog)
└── settings.ts      (getSetting, setSetting, listSettingsForProvider — built + tested, unused until follow-up)
```

**Rules:**

- Table objects are imported from `src/db/schema.ts` (pure Drizzle).
- Accessors receive `db: LibSQLDatabase` as their first parameter. They never obtain `db` themselves.
- Every accessor must have tests in `tests/lib/data/` against the real-SQLite test harness.

---

## 5. db injection seam

There are exactly two entry points that obtain a `LibSQLDatabase` and pass it to accessors:

1. **API endpoints** — `const sdk = createPluginContext()` then `runX({ db: sdk.db, sdk, ctx })` (see §6). The tested `runMethod` receives `db` as an injected `HandlerDeps` param, so the wrapper is never exercised by unit tests.
2. **init.ts** — uses `ctx.db` from the SDK's init context.

Both pass `db` to accessor functions. No other code obtains `db`.

---

## 6. Endpoint handler pattern (testable HTTP layer)

Each endpoint file exports a `runMethod({ db, sdk, ctx }: HandlerDeps): Promise<Response>` function and a thin Astro wrapper:

- **`runMethod`** (the testable surface) receives `db`/`sdk`/`ctx` as injected deps. Auth (`sdk.auth.requireAdmin`), body/query parsing, zod validation, accessor calls, and full `Response` construction all live INSIDE it. Responses use a `{ success: boolean, data?/error?, fields? }` envelope; validation failures return 422 with a `fields` map, auth failures 401, domain errors their status (404/409/400), unexpected errors 500.
- **The wrapper** (`export const POST: APIRoute = (context) => { const sdk = createPluginContext(); return runPost({ db: sdk.db, sdk, ctx: context }); }`) sources `db` from `sdk.db` via `createPluginContext()`. It is NOT unit-tested.

The handler module stays importable under bare Node via a Node ESM loader hook: `tests/stubs/loader.mjs` redirects `pelerin:` specifiers to inert stub modules (`tests/stubs/plugin-sdk.mjs`) and appends `.ts` to extension-less relative specifiers. `tests/stubs/register.mjs` exports `ensureLoader()` which each handler test calls before `await import(handler)`. The stub is never exercised — `runMethod` receives real `db` (harness or poison-db) and a fake `sdk` (`makeFakeSdk`) via injection.

Shared test infrastructure (ported verbatim from `../ecomm_plugin/`): `tests/api/helpers.ts` (`makeFakeSdk`, `makeCtx`, `poisonDb`, `unauthorizedError`, `forbiddenError`), `tests/api/handlers/_matrix.ts` (`adminAuthFail`/`validationFail`/`happyPath`/`errorWrap`), and per-handler test files under `tests/api/handlers/` (mirror the source tree with **bare param names** — `id.test.ts`, NOT `[id].test.ts`, because `node --test` treats `[`/`]` as a glob char class and silently skips bracket paths; `tests/api/no-bracket-paths.test.ts` enforces this).

---

## 7. Dispatch flow — the critical path

`src/lib/dispatch.ts` exports `dispatchEvent(db, event, payload)` — the testable function that turns an event into sent notifications. `src/init.ts` is a thin wiring function that subscribes to `*` and calls `dispatchEvent(ctx.db, event, payload)`.

**Flow:**

1. `findActiveRulesMatching(db, event)` — query active rules, filter by `matches(pattern, event)`, sort by specificity (exact > `prefix.*` > `*`)
2. `getTemplate(db, rule.template_id)` — load the rule's template; if missing, `createLog` failure and continue
3. `interpolate(template.subject, payload)` and body — render `{{ }}` placeholders
4. `resolveRecipients(rule.to, payload)` — interpolate, split by comma, trim, filter empty; same for cc/bcc
5. `getProviderForRule(rule, isDev)` — dev mode (`NOTIFICATIONS_DEV_MODE=true`) routes to the local provider; the rule's `provider_name` is preserved in the log regardless
6. `provider.send({ to, cc, bcc, subject, bodyHtml, bodyText }, db)` — send via the resolved provider; `db` is passed as the second argument so the provider can read its decrypted credentials from the `notification_settings` table at send time
7. `createLog(db, { ...result })` — write a `notification_logs` row with success/failure, full content, and message_id

One bad rule does not kill the bus subscriber — each rule is wrapped in try/catch.

---

## 8. Provider registry

Map-based registry (`src/providers/registry.ts`): `registerProvider`/`getProvider`/`listProviders`. Each provider module auto-registers on import via `src/providers/index.ts`.

Providers implement the `NotificationProvider` interface (`src/providers/interface.ts`): `name`, `channels`, `getConfigSchema()`, `send(params, db)`. The `send` method receives `db: LibSQLDatabase` as its second parameter; each provider reads its credentials from `notification_settings` via the `settings.ts` accessor + `decryptIfNeeded` (see §12). The local provider ignores `db`.

**Providers:** sendgrid, mailgun, ses (real AWS send via `@aws-sdk/client-ses`), smtp, brevo, local (dev mode only).

**SES specifics:** `ses.send()` constructs an `SESClient` from decrypted credentials and sends via `SendEmailCommand` (`Source`, `Destination`, `Message` with `Subject`/`Body` HTML+text). The SDK is **dynamically imported inside `send()`** (`await import('@aws-sdk/client-ses')`) so the large SDK loads only when SES actually dispatches, not at plugin startup (all 6 providers auto-import at startup). The `SESClient` (the only thing that does I/O) is obtained via a module-level `sesClientFactory`; the default factory constructs a real `SESClient`, and tests substitute a fake via `setSesClientFactory()` / `resetSesClientFactory()` — this is the test seam because `node:test` has no `mock.module` in Node 25 (verified: `typeof mock.module === 'undefined'`), so the SDK module cannot be replaced at import time. SDK errors (invalid creds, unverified sender, throttling) surface as `{ success: false, error: 'SES send failed: <message>' }`.

**SES `ses_from_email`** is a required settings field (type `text`, the SES `Source`) configured alongside region/access/secret. Unlike the other 4 providers' `*_FROM_EMAIL` (env-only, a documented limitation), SES's from-address is operationally critical — it must be a **verified identity** in the AWS account. The settings endpoint handles it generically (text field, returned decrypted, not masked).

**SES operational requirements (documented, not coded):** new SES accounts are in **sandbox mode** (send only to verified addresses); sender identities (the `Source` email/domain) must be verified via **DKIM/SPF or email confirmation**; production access (sending to any address) requires an **AWS support request**. These surface as SDK errors reported via `{ success: false, error }` — no special code path.

---

## 9. Test harness (`tests/db/harness.ts`)

In-memory libSQL database that creates all 4 tables from `schema.ts`. Provides:

- `createTestDb()` → `{ db, cleanup }`
- `resetDb(db)` — clears all tables in FK-safe order
- `insertFixture(db, tableName, row)` — single-row insert helper
- `seedMinimal(db)` — inserts 1 template + 2 rules (exact `shop.order.created` + wildcard `shop.*`), returns stable IDs

The harness `db` is the same Drizzle `LibSQLDatabase` type used in prod, so accessors behave identically in tests and prod.

**Test command:** `node --test tests/full-suite.test.ts` — the canonical suite runner. It spawns `node --test <every Tier 1-3 file>` as a child, strips `NODE_TEST_CONTEXT`/`NODE_TEST_WORKER_ID` from the child env (without which the child runs as a nested worker — 0 tests, exit 0, a silent false green), and asserts `testCount >= N`. To run a single file during development: `node --test tests/api/handlers/rules/create.test.ts`. NOTE: dynamic-route test files use bare param names (`id.test.ts`, not `[id].test.ts`) because `node --test` treats `[`/`]` as a glob character class and silently skips bracket paths; `tests/api/no-bracket-paths.test.ts` guards this. When adding a test file, add its path to `TEST_FILES` in `tests/full-suite.test.ts` (the `testCount` guard catches mass silent skips, not individual omissions).

---

## 10. Dev mode

Controlled by the `NOTIFICATIONS_DEV_MODE` environment variable. When `"true"`, the dispatch logic uses the local provider (returns `{ success: true, messageId: 'local-<uuid>' }` without a network call). The env var is checked at dispatch time, not import time. The rule's `provider_name` is preserved in logs regardless of which provider handled the dispatch.

---

## 11. Package dependencies

```json
{
  "peerDependencies": {
    "astro": "^7.0.0"
  },
  "dependencies": {
    "@aws-sdk/client-ses": "^3.731.0",
    "zod": "^3.25.76"
  }
}
```

`drizzle-orm` and `@libsql/client` come transitively from the CMS (not direct deps of this plugin). Node 25 strips TypeScript types natively — no build step needed for tests.

`@aws-sdk/client-ses` is the **first AWS SDK in the CMS plugin ecosystem** (a direct runtime dependency of this plugin only, not a peer). It is dynamically imported inside `ses.send()` so it loads only when SES dispatches — plugin startup is not penalized for non-SES users.

**Required environment variable:** `NOTIFICATIONS_ENCRYPTION_KEY` must be set for credential encryption (AES-256-GCM via `src/lib/crypto.ts`). There is no default; `encrypt`/`decrypt` throw if it is absent. Tests set it in setup; prod fails loud if it is missing. `NOTIFICATIONS_DEV_MODE` is the optional dev-mode toggle (see §10).

---

## 12. Credential storage & remaining follow-up

The gaps previously deferred to the `notifications-provider-settings` request are now closed. Provider credentials are stored encrypted at rest and read from the settings table at send time:

- **Provider credentials read from `notification_settings`, not `process.env`.** All 6 providers call `getSetting(db, key)` (the `src/lib/data/settings.ts` accessor) + `decryptIfNeeded` to read their credentials. They no longer read `process.env` for API keys. ("From" email addresses — `SENDGRID_FROM_EMAIL` etc. — remain env/default; they are not in the admin UI and re-routing them is out of scope.)
- **Real encryption via `src/lib/crypto.ts`.** AES-256-GCM keyed off `NOTIFICATIONS_ENCRYPTION_KEY` only (no CMS env-var fallback, no insecure default — throws if absent). `encrypt`/`decrypt`/`isEncrypted`/`decryptIfNeeded` mirror the ecomm plugin's crypto module.
- **Settings endpoint is admin-only and uses real crypto.** `src/api/notifications/providers/[name]/settings.ts` calls `requireAdmin` on both GET and POST, uses the `settings.ts` accessor with injected `db`, encrypts on write (`encrypt`), decrypts on read (`decryptIfNeeded`), and masks password-type fields in GET responses. The base64 toy crypto and in-memory `Map` fallback have been deleted.
- **`src/lib/data/settings.ts` accessor is now used.** Both the settings endpoint and the providers call it — it is no longer dead code.

**Remaining follow-up (deferred to the next request, `notifications-ses-send`):**

- **SES `send()` is now implemented.** The `notifications-ses-send` request replaced the placeholder return with a real AWS SES `SendEmailCommand` call via `@aws-sdk/client-ses`. SES reads `ses_region`/`ses_access_key`/`ses_secret_key`/`ses_from_email` from the settings table, constructs an `SESClient`, and returns `{ success: true, messageId: <AWS MessageId> }` (or `{ success: false, error }` on SDK failure). The `ses-placeholder-<timestamp>` placeholder is gone. **All 4 originally-deferred gaps from this section are now closed** (credentials from settings, real crypto, admin-only settings endpoint, settings accessor used) — and the SES send gap is closed too. There are no remaining open follow-ups for the provider layer.

---

## 13. File structure

```
pelerin_notifications/
├── pelerin.manifest.json       # Plugin contract (routes, endpoints, nav)
├── package.json                # Peer deps + zod
├── AGENTS.md                   # This file
├── src/
│   ├── db/
│   │   ├── schema.ts           # sole Drizzle schema definition
│   │   └── seed.ts             # no-op (rules/templates are admin-created)
│   ├── lib/
│   │   ├── data/               # accessors (rules, templates, logs, settings)
│   │   ├── dispatch.ts         # dispatchEvent(db, event, payload)
│   │   ├── matcher.ts          # event pattern matching
│   │   ├── interpolation.ts    # {{ }} template rendering
│   │   ├── rule-lookup.ts      # specificity-ordered rule matching
│   │   └── provider-selection.ts # dev-mode provider switching
│   ├── providers/              # registry + 6 providers + interface
│   ├── schemas/                # zod schemas (rule, template)
│   ├── api/notifications/      # endpoint handlers + Astro wrappers
│   ├── init.ts                 # event bus subscriber wiring
│   ├── components/             # Breadcrumbs.astro, Pagination.astro
│   └── pages/admin/            # admin UI (Astro, TS-native)
└── tests/
    ├── db/                     # harness
    ├── lib/data/               # accessor tests
    ├── api/                    # handler tests
    ├── dispatch/               # dispatch + init tests
    ├── providers/              # provider tests
    ├── struct/                 # structural grep-guards
    └── ...                     # other tests
```

---

## 14. Development workflow

Before committing, run all quality checks against the code you changed. Each check has different scope and expectations:

| Check | Command | Scope | Must pass? |
|---|---|---|---|
| Format | `npm run format:check` | All files in repo (excluding ignores) | Yes — exit 0 |
| Lint | `npm run lint` | `src/` + root config files (excludes `tests/`) | Yes — exit 0. If pre-existing errors exist (e.g. `no-explicit-any` in `pelerin-plugin-sdk.d.ts`), do **not** introduce new ones beyond them |
| Type-check | `npm run type-check` | `src/**/*.ts` only (excludes `tests/` and `*.astro`) | Yes — exit 0. New `Cannot find module` errors or new type errors from your changes are failures |
| Tests | `npm run test` | Full test suite via `tests/full-suite.test.ts` | Yes — exit 0 |
| Coverage | `npm run test:coverage` | Same as tests, with coverage report | Informational — not gated, but useful to verify you haven't dropped coverage |

Steps:
1. **Read** this file and `reespec/decisions.md` before modifying code
2. **Run checks relevant to your change** — if you only touched `src/`, run all four; if only tests, run format + test
3. **Run** the full suite: `npm run test`
4. **Manual smoke check**: `GET /api/plugins/notifications/rules` returns real rows; publish an event with `NOTIFICATIONS_DEV_MODE=true` and confirm a `notification_logs` row appears

> The CI (`$include: .github/workflows/ci.yml`) runs `format:check` (fatal), `lint` (continue-on-error), `type-check` (continue-on-error), and `test` (fatal, with coverage). The dev workflow matches the CI — pre-existing lint/type-check noise does not block CI, but **format and test failures always do**.
