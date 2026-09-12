/**
 * Dev-mode detection.
 *
 * The CMS loads its `.env` into `import.meta.env`, not `process.env`, so
 * `isDevMode()` must prefer `import.meta.env` and fall back to `process.env`
 * (the same ordering `crypto.ts` uses for the encryption key). This is the
 * single source of truth for "is the plugin in dev mode" — the 7 call sites
 * that previously read `process.env.NOTIFICATIONS_DEV_MODE` directly delegate
 * here.
 *
 * An optional `EnvSource` can be injected in tests (the precedence logic is not
 * reproducible under bare Node, where `import.meta.env` is undefined) — the
 * same "inject the I/O collaborator" principle as the SES/SMTP factory seams.
 */

export interface EnvSource {
  importMeta?: Record<string, string | undefined>;
  process?: NodeJS.ProcessEnv;
}

interface ImportMetaWithEnv {
  env?: Record<string, string | undefined>;
}

/** Resolve whether the plugin is in dev mode. Prefers import.meta.env. */
export function isDevMode(env?: EnvSource): boolean {
  const importMeta = (import.meta as unknown as ImportMetaWithEnv).env;
  const source: EnvSource = env ?? { importMeta, process: process.env };
  const raw = source.importMeta?.NOTIFICATIONS_DEV_MODE ?? source.process?.NOTIFICATIONS_DEV_MODE;
  return raw === 'true';
}
