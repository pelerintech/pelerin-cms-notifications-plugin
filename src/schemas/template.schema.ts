import { z } from 'zod';

/** Schema for creating/updating a notification template. */
export const templateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body_html: z.string().nullable().optional(),
  body_text: z.string().nullable().optional(),
});

export type TemplateSchemaInput = z.infer<typeof templateSchema>;
