# Pelerin Notifications

Notification dispatch plugin for [Pelerin CMS](https://github.com/pelerintech/pelerin-cms). Listens to CMS events on the event bus and dispatches notifications (email in v1) via a pluggable provider registry supporting SendGrid, Mailgun, SES, SMTP, Brevo, and a local dev provider.

[![CI](https://img.shields.io/github/actions/workflow/status/pelerintech/pelerin-notifications-plugin/ci.yml?branch=main&label=CI)](https://github.com/pelerintech/pelerin-notifications-plugin/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-~95%25-brightgreen)](https://github.com/pelerintech/pelerin-notifications-plugin/actions)

## Installation

This plugin is installed into a running Pelerin CMS instance. The CMS discovers plugins via `pelerin.config.mjs`:

```js
export default {
  plugins: [
    {
      name: 'pelerin_notifications',
      source: 'git@github.com:pelerintech/pelerin-notifications-plugin.git',
      ref: 'main',
    },
  ],
};
```

Run from the CMS root directory:

```bash
npm run plugins:install   # clones the plugin and installs its dependencies
npm run dev               # starts the CMS dev server with the plugin loaded
```

See the [Pelerin CMS documentation](https://github.com/pelerintech/pelerin-cms) for detailed instructions.

## Available scripts

| Script                  | Command                                                             | Description                         |
| ----------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| `npm run format`        | `prettier --write .`                                                | Format all source files             |
| `npm run format:check`  | `prettier --check .`                                                | Check formatting without writing    |
| `npm run lint`          | `eslint .`                                                          | Lint all source files               |
| `npm run type-check`    | `tsc --noEmit`                                                      | Type-check TypeScript files         |
| `npm test`              | `node --test tests/full-suite.test.ts`                              | Run unit test suite                 |
| `npm run test:coverage` | `node --experimental-test-coverage --test tests/full-suite.test.ts` | Run unit tests with coverage report |

## Contributing / Local development

This plugin follows a strict RED → GREEN → REFACTOR workflow. See [`AGENTS.md`](./AGENTS.md) for the full development guide.

After every change, run:

```bash
npm run format && npm run lint && npm test
```

Before submitting a pull request, also run:

```bash
npm run type-check
```

### Required environment variables

| Variable | Required | Description |
|---|---|---|
| `NOTIFICATIONS_ENCRYPTION_KEY` | Yes | AES-256-GCM key for encrypting provider credentials at rest |
| `NOTIFICATIONS_DEV_MODE` | No | Set to `true` to use the local provider (skips network calls) |

### CI pipeline

Push and pull request checks run via GitHub Actions (`.github/workflows/ci.yml`):

- **Format check** (gate): Prettier formatting compliance
- **Quality** (allow_failure): lint, Gitleaks secrets scan, `npm audit`
- **Type-check** (allow_failure): `tsc --noEmit`
- **Test** (gate, depends on format): full test suite with coverage reporting and artifact upload
