import { z } from 'zod';

/** Schema for creating/updating a notification template. */
export const templateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body_html: z.string().nullable().optional(),
  body_text: z.string().nullable().optional(),
});

/** Schema for creating a template — requires at least one body field. */
export const createTemplateSchema = templateSchema.refine(
  (data) => data.body_html || data.body_text,
  { message: 'At least one body field (html or text) is required' }
);

export type TemplateSchemaInput = z.infer<typeof templateSchema>;
