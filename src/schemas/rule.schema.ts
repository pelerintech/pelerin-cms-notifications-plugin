import { z } from 'zod';

/** Simple email validation regex (splits by comma, validates each). */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validEmailList(val: string): boolean {
  return val.split(',').every((s) => emailRegex.test(s.trim()));
}

function validEmailListOrEmpty(val: string | null | undefined): boolean {
  if (!val) return true;
  return val.split(',').every((s) => emailRegex.test(s.trim()));
}

/**
 * Event pattern must be one of:
 * - A fully qualified event name: `shop.order.created`
 * - A prefix wildcard: `shop.*`
 * - The global wildcard: `*`
 */
const eventPatternRegex = /^(\*|[a-z0-9]+(\.[a-z0-9]+)*(\.\*)?)$/;

/** Schema for creating/updating a notification rule. */
export const ruleSchema = z.object({
  event_pattern: z.string().min(1).regex(eventPatternRegex, 'Invalid event pattern format'),
  template_id: z.string().min(1),
  provider_name: z.string().min(1),
  channel: z.enum(['email']).default('email'),
  to: z.string().min(1).refine(validEmailList, 'Must be comma-separated valid email addresses'),
  cc: z
    .string()
    .nullable()
    .optional()
    .refine(validEmailListOrEmpty, 'Must be comma-separated valid email addresses'),
  bcc: z
    .string()
    .nullable()
    .optional()
    .refine(validEmailListOrEmpty, 'Must be comma-separated valid email addresses'),
  active: z.boolean().optional(),
});

export type RuleSchemaInput = z.infer<typeof ruleSchema>;
