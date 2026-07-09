/**
 * Real-SQLite test harness for the pelerin_notifications data accessors.
 *
 * Spins up an in-memory libSQL database, creates all plugin tables from
 * `src/db/schema.ts` (the pure-Drizzle schema that mirrors `src/db/config.ts`),
 * and returns a `LibSQLDatabase` instance that data accessors can query.
 *
 * The `db` returned here is the same Drizzle `LibSQLDatabase` type that
 * the CMS provides in prod, so accessors behave identically in tests and prod.
 */
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../../src/db/schema.ts';
import {
  notification_rules,
  notification_templates,
  notification_logs,
  notification_settings,
} from '../../src/db/schema.ts';

const COLUMNS_SYMBOL = Symbol.for('drizzle:Columns');

/** All plugin table objects from the schema module. */
const tables = Object.entries(schema).filter(
  ([, v]) => v && typeof v === 'object' && Object.getOwnPropertySymbols(v).some(s => s === COLUMNS_SYMBOL)
) as [string, Record<string, any>][];

/**
 * Generate a CREATE TABLE statement from a Drizzle sqliteTable object by
 * introspecting its columns (name, SQL type, notNull, primary).
 */
function createTableSQL(tableName: string, table: Record<string, any>): string {
  const cols = table[COLUMNS_SYMBOL] as Record<string, any>;
  const colDefs = Object.values(cols).map((col: any) => {
    const type = col.getSQLType().toUpperCase();
    let def = `"${col.name}" ${type}`;
    if (col.primary) def += ' PRIMARY KEY';
    if (col.notNull) def += ' NOT NULL';
    return def;
  });
  return `CREATE TABLE "${tableName}" (\n  ${colDefs.join(',\n  ')}\n)`;
}

export interface TestDb {
  db: LibSQLDatabase<typeof schema>;
  cleanup: () => Promise<void>;
}

/**
 * Create a fresh in-memory database with all plugin tables.
 * Each call is isolated — no shared state across tests.
 */
export async function createTestDb(): Promise<TestDb> {
  const db = drizzle(':memory:', { schema });

  // Create all tables. Drop order doesn't matter for CREATE; order only
  // matters for reset/seed clears (handled by resetDb).
  for (const [name, table] of tables) {
    await db.run(sql.raw(createTableSQL(name, table)));
  }

  const cleanup = async () => {
    // libSQL in-memory client is GC'd; nothing to close explicitly.
    // Kept async for future file-based harness compatibility.
  };

  return { db, cleanup };
}

/** Map of table name → table object, for insertFixture. */
const tableByName = Object.fromEntries(tables) as Record<string, Record<string, any>>;

/** Tables in FK-safe clear order (children before parents). */
const CLEAR_ORDER = [notification_logs, notification_rules, notification_templates, notification_settings];

/** Clear all plugin tables in FK-safe order (children before parents). */
export async function resetDb(db: LibSQLDatabase<typeof schema>): Promise<void> {
  for (const table of CLEAR_ORDER) {
    await db.delete(table);
  }
}

/** Insert a single row into a named table. */
export async function insertFixture(
  db: LibSQLDatabase<typeof schema>,
  tableName: string,
  row: Record<string, any>
): Promise<void> {
  const table = tableByName[tableName];
  if (!table) throw new Error(`Unknown table: ${tableName}`);
  await db.insert(table).values(row);
}

export interface NotificationFixtures {
  templateId: string;
  exactRuleId: string;
  wildcardRuleId: string;
}

function rid(): string {
  return crypto.randomUUID();
}

/**
 * Seed a predictable minimal dataset for dispatch tests:
 * 1 template, 2 rules (one exact `shop.order.created`, one `shop.*`), both active,
 * both using provider_name 'sendgrid' (the local provider handles the actual send
 * in dev mode; the rule's provider_name is preserved in logs per the dev-mode decision).
 * Returns stable IDs so tests can reference specific entities.
 */
export async function seedMinimal(db: LibSQLDatabase<typeof schema>): Promise<NotificationFixtures> {
  const now = new Date();
  const f: NotificationFixtures = {
    templateId: rid(),
    exactRuleId: rid(),
    wildcardRuleId: rid(),
  };

  await db.insert(notification_templates).values({
    id: f.templateId,
    name: 'Order Confirmation',
    subject: 'Order {{ order_id }}',
    body_html: '<p>Hi {{ customer_email }}</p>',
    body_text: null,
    created_at: now,
    updated_at: null,
  });

  await db.insert(notification_rules).values([
    {
      id: f.exactRuleId,
      event_pattern: 'shop.order.created',
      template_id: f.templateId,
      provider_name: 'sendgrid',
      channel: 'email',
      to: '{{ customer_email }}',
      cc: null,
      bcc: null,
      active: true,
      created_at: now,
      updated_at: null,
    },
    {
      id: f.wildcardRuleId,
      event_pattern: 'shop.*',
      template_id: f.templateId,
      provider_name: 'sendgrid',
      channel: 'email',
      to: 'admin@example.com',
      cc: null,
      bcc: null,
      active: true,
      created_at: now,
      updated_at: null,
    },
  ]);

  return f;
}

export { schema };

// re-export schema tables for convenience in tests
export {
  notification_rules,
  notification_templates,
  notification_logs,
  notification_settings,
} from '../../src/db/schema.ts';
