import { eq, and, like, desc, sql, count } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { notification_rules } from '../../db/schema.ts';
import { matches } from '../matcher.ts';

/** A notification rule row as returned by accessors. */
export interface RuleRow {
  id: string;
  event_pattern: string;
  template_id: string;
  provider_name: string;
  channel: string;
  to: string;
  cc: string | null;
  bcc: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date | null;
}

export interface ListRulesOptions {
  page: number;
  limit: number;
  search?: string;
  active?: boolean;
}

export interface ListRulesResult {
  data: RuleRow[];
  total: number;
}

/** Error thrown by rule accessors with a machine-readable code. */
export class RuleError extends Error {
  code: 'not_found' | 'duplicate';
  constructor(code: 'not_found' | 'duplicate', message: string) {
    super(message);
    this.code = code;
    this.name = 'RuleError';
  }
}

export interface CreateRuleInput {
  event_pattern: string;
  template_id: string;
  provider_name: string;
  channel?: string;
  to: string;
  cc?: string | null;
  bcc?: string | null;
  active?: boolean;
}

export type UpdateRuleInput = Partial<CreateRuleInput>;

/** List rules with optional search/active filters and pagination, newest first. */
export async function listRules(
  db: LibSQLDatabase,
  opts: ListRulesOptions
): Promise<ListRulesResult> {
  const conditions = [];
  if (opts.search) {
    conditions.push(like(notification_rules.event_pattern, `%${opts.search}%`));
  }
  if (opts.active !== undefined) {
    conditions.push(eq(notification_rules.active, opts.active));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.select().from(notification_rules)
      .$dynamic()
      .where(where)
      .orderBy(desc(notification_rules.created_at))
      .limit(opts.limit)
      .offset((opts.page - 1) * opts.limit),
    db.select({ value: count() }).from(notification_rules).$dynamic().where(where),
  ]);

  return {
    data: rows as RuleRow[],
    total: (totalRows[0] as { value: number })?.value ?? 0,
  };
}

/** Get a single rule by id, or null if not found. */
export async function getRule(
  db: LibSQLDatabase,
  id: string
): Promise<RuleRow | null> {
  const rows = await db.select().from(notification_rules)
    .where(eq(notification_rules.id, id));
  return (rows[0] as RuleRow | undefined) ?? null;
}

/** Create a rule. Throws RuleError code 'duplicate' if the (event_pattern, template_id, provider_name, channel) quadruple already exists. */
export async function createRule(
  db: LibSQLDatabase,
  input: CreateRuleInput
): Promise<RuleRow> {
  const channel = input.channel ?? 'email';
  // Check for existing quadruple via SELECT before insert (matches ecomm's pattern).
  const existing = await db.select({ id: notification_rules.id })
    .from(notification_rules)
    .where(and(
      eq(notification_rules.event_pattern, input.event_pattern),
      eq(notification_rules.template_id, input.template_id),
      eq(notification_rules.provider_name, input.provider_name),
      eq(notification_rules.channel, channel),
    ));
  if (existing.length > 0) {
    throw new RuleError('duplicate', 'Rule with this event_pattern, template_id, provider_name, and channel already exists');
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const row = {
    id,
    event_pattern: input.event_pattern,
    template_id: input.template_id,
    provider_name: input.provider_name,
    channel,
    to: input.to,
    cc: input.cc ?? null,
    bcc: input.bcc ?? null,
    active: input.active ?? true,
    created_at: now,
    updated_at: null as Date | null,
  };
  await db.insert(notification_rules).values(row);
  return row as RuleRow;
}

/** Update a rule. Throws RuleError code 'not_found' if the id doesn't exist. */
export async function updateRule(
  db: LibSQLDatabase,
  id: string,
  input: UpdateRuleInput
): Promise<RuleRow> {
  const existing = await getRule(db, id);
  if (!existing) {
    throw new RuleError('not_found', 'Rule not found');
  }
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.event_pattern !== undefined) updates.event_pattern = input.event_pattern;
  if (input.template_id !== undefined) updates.template_id = input.template_id;
  if (input.provider_name !== undefined) updates.provider_name = input.provider_name;
  if (input.channel !== undefined) updates.channel = input.channel;
  if (input.to !== undefined) updates.to = input.to;
  if (input.cc !== undefined) updates.cc = input.cc;
  if (input.bcc !== undefined) updates.bcc = input.bcc;
  if (input.active !== undefined) updates.active = input.active;

  await db.update(notification_rules).set(updates).where(eq(notification_rules.id, id));
  const updated = await getRule(db, id);
  return updated!;
}

/** Compute specificity score for a pattern: exact=2, prefix.*=1, *=0. Higher = more specific. */
function specificity(pattern: string): number {
  if (pattern === '*') return 0;
  if (pattern.endsWith('.*')) return 1;
  return 2;
}

/** Find all active rules matching an event, ordered by specificity (most specific first). */
export async function findActiveRulesMatching(
  db: LibSQLDatabase,
  event: string
): Promise<RuleRow[]> {
  const rows = await db.select().from(notification_rules)
    .where(eq(notification_rules.active, true));
  const matching = (rows as RuleRow[])
    .filter(rule => matches(rule.event_pattern, event))
    .sort((a, b) => specificity(b.event_pattern) - specificity(a.event_pattern));
  return matching;
}

/** Delete a rule by id. */
export async function deleteRule(
  db: LibSQLDatabase,
  id: string
): Promise<void> {
  await db.delete(notification_rules).where(eq(notification_rules.id, id));
}
