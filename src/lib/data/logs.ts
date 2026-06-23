import { eq, and, like, desc, gte, lte, count } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { notification_logs } from '../../db/schema.ts';

/** A notification log row as returned by accessors. */
export interface LogRow {
  id: string;
  event_name: string;
  rule_id: string;
  provider_name: string;
  to: string;
  cc: string | null;
  bcc: string | null;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  success: boolean;
  error: string | null;
  message_id: string | null;
  created_at: Date;
}

export interface ListLogsOptions {
  page: number;
  pageSize: number;
  provider?: string;
  status?: 'success' | 'failure';
  rule?: string;
  from?: Date;
  to?: Date;
}

export interface ListLogsResult {
  data: LogRow[];
  total: number;
}

export interface CreateLogInput {
  event_name: string;
  rule_id: string;
  provider_name: string;
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  body_html?: string | null;
  body_text?: string | null;
  success: boolean;
  error?: string | null;
  message_id?: string | null;
}

/** List logs with optional filters and pagination, newest first. */
export async function listLogs(
  db: LibSQLDatabase,
  opts: ListLogsOptions
): Promise<ListLogsResult> {
  const conditions = [];
  if (opts.provider) {
    conditions.push(eq(notification_logs.provider_name, opts.provider));
  }
  if (opts.status !== undefined) {
    conditions.push(eq(notification_logs.success, opts.status === 'success'));
  }
  if (opts.rule) {
    conditions.push(eq(notification_logs.rule_id, opts.rule));
  }
  if (opts.from) {
    conditions.push(gte(notification_logs.created_at, opts.from));
  }
  if (opts.to) {
    conditions.push(lte(notification_logs.created_at, opts.to));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.select().from(notification_logs)
      .$dynamic()
      .where(where)
      .orderBy(desc(notification_logs.created_at))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ value: count() }).from(notification_logs).$dynamic().where(where),
  ]);

  return {
    data: rows as LogRow[],
    total: (totalRows[0] as { value: number })?.value ?? 0,
  };
}

/** Get a single log by id, or null if not found. */
export async function getLog(
  db: LibSQLDatabase,
  id: string
): Promise<LogRow | null> {
  const rows = await db.select().from(notification_logs)
    .where(eq(notification_logs.id, id));
  return (rows[0] as LogRow | undefined) ?? null;
}

/** Create a log entry (the dispatch write). */
export async function createLog(
  db: LibSQLDatabase,
  input: CreateLogInput
): Promise<LogRow> {
  const now = new Date();
  const id = crypto.randomUUID();
  const row = {
    id,
    event_name: input.event_name,
    rule_id: input.rule_id,
    provider_name: input.provider_name,
    to: input.to,
    cc: input.cc ?? null,
    bcc: input.bcc ?? null,
    subject: input.subject,
    body_html: input.body_html ?? null,
    body_text: input.body_text ?? null,
    success: input.success,
    error: input.error ?? null,
    message_id: input.message_id ?? null,
    created_at: now,
  };
  await db.insert(notification_logs).values(row);
  return row as LogRow;
}
