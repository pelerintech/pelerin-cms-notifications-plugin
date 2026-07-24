import { eq, and, like, desc, count } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { notification_templates, notification_rules } from '../../db/schema.ts';

/** A notification template row as returned by accessors. */
export interface TemplateRow {
  id: string;
  name: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  created_at: Date;
  updated_at: Date | null;
}

/** Error thrown by template accessors with a machine-readable code. */
export class TemplateError extends Error {
  code: 'not_found' | 'in_use';
  constructor(code: 'not_found' | 'in_use', message: string) {
    super(message);
    this.code = code;
    this.name = 'TemplateError';
  }
}

export interface ListTemplatesOptions {
  page: number;
  limit: number;
  search?: string;
}

export interface ListTemplatesResult {
  data: TemplateRow[];
  total: number;
}

export interface CreateTemplateInput {
  name: string;
  subject: string;
  body_html?: string | null;
  body_text?: string | null;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

/** List templates with optional search filter and pagination, newest first. */
export async function listTemplates(
  db: LibSQLDatabase,
  opts: ListTemplatesOptions
): Promise<ListTemplatesResult> {
  const conditions = [];
  if (opts.search) {
    conditions.push(like(notification_templates.name, `%${opts.search}%`));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(notification_templates)
      .$dynamic()
      .where(where)
      .orderBy(desc(notification_templates.created_at))
      .limit(opts.limit)
      .offset((opts.page - 1) * opts.limit),
    db.select({ value: count() }).from(notification_templates).$dynamic().where(where),
  ]);

  return {
    data: rows as TemplateRow[],
    total: (totalRows[0] as { value: number })?.value ?? 0,
  };
}

/** Get a single template by id, or null if not found. */
export async function getTemplate(db: LibSQLDatabase, id: string): Promise<TemplateRow | null> {
  const rows = await db
    .select()
    .from(notification_templates)
    .where(eq(notification_templates.id, id));
  return (rows[0] as TemplateRow | undefined) ?? null;
}

/** Create a template. */
export async function createTemplate(
  db: LibSQLDatabase,
  input: CreateTemplateInput
): Promise<TemplateRow> {
  const now = new Date();
  const id = crypto.randomUUID();
  const row = {
    id,
    name: input.name,
    subject: input.subject,
    body_html: input.body_html ?? null,
    body_text: input.body_text ?? null,
    created_at: now,
    updated_at: null as Date | null,
  };
  await db.insert(notification_templates).values(row);
  return row as TemplateRow;
}

/** Update a template. Throws TemplateError code 'not_found' if the id doesn't exist. */
export async function updateTemplate(
  db: LibSQLDatabase,
  id: string,
  input: UpdateTemplateInput
): Promise<TemplateRow> {
  const existing = await getTemplate(db, id);
  if (!existing) {
    throw new TemplateError('not_found', 'Template not found');
  }
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.subject !== undefined) updates.subject = input.subject;
  if (input.body_html !== undefined) updates.body_html = input.body_html;
  if (input.body_text !== undefined) updates.body_text = input.body_text;

  await db.update(notification_templates).set(updates).where(eq(notification_templates.id, id));
  const updated = await getTemplate(db, id);
  return updated!;
}

/** Delete a template by id. Throws TemplateError('in_use') if rules reference it. */
export async function deleteTemplate(db: LibSQLDatabase, id: string): Promise<void> {
  // Check if any rules reference this template
  const referencingRules = await db
    .select({ id: notification_rules.id })
    .from(notification_rules)
    .where(eq(notification_rules.template_id, id));
  if (referencingRules.length > 0) {
    throw new TemplateError(
      'in_use',
      `Template is referenced by ${referencingRules.length} rule(s). Delete or update those rules first.`
    );
  }
  await db.delete(notification_templates).where(eq(notification_templates.id, id));
}
