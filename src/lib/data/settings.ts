import { eq, like } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { notification_settings } from '../../db/schema.ts';

/** Get a setting value by key, or null if not found. */
export async function getSetting(
  db: LibSQLDatabase,
  key: string
): Promise<string | null> {
  const rows = await db.select().from(notification_settings)
    .where(eq(notification_settings.key, key));
  return (rows[0] as { value: string } | undefined)?.value ?? null;
}

/** Set (upsert) a setting value by key. */
export async function setSetting(
  db: LibSQLDatabase,
  key: string,
  value: string
): Promise<void> {
  const existing = await db.select().from(notification_settings)
    .where(eq(notification_settings.key, key));
  if (existing.length > 0) {
    await db.update(notification_settings)
      .set({ value })
      .where(eq(notification_settings.key, key));
  } else {
    await db.insert(notification_settings).values({
      id: crypto.randomUUID(),
      key,
      value,
      created_at: new Date(),
    });
  }
}

/** List all settings for a provider (keys with `${providerName}_` prefix, prefix stripped). */
export async function listSettingsForProvider(
  db: LibSQLDatabase,
  providerName: string
): Promise<Record<string, string>> {
  const prefix = `${providerName}_`;
  const rows = await db.select().from(notification_settings)
    .where(like(notification_settings.key, `${prefix}%`));
  const result: Record<string, string> = {};
  for (const row of rows as { key: string; value: string }[]) {
    const strippedKey = row.key.slice(prefix.length);
    result[strippedKey] = row.value;
  }
  return result;
}
