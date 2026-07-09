import { z } from 'zod';

/** Schema for creating/updating a notification rule. */
export const ruleSchema = z.object({
  event_pattern: z.string().min(1),
  template_id: z.string().min(1),
  provider_name: z.string().min(1),
  channel: z.string().min(1).default('email'),
  to: z.string().min(1),
  cc: z.string().nullable().optional(),
  bcc: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export type RuleSchemaInput = z.infer<typeof ruleSchema>;
