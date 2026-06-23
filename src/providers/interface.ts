/**
 * Notification provider interface.
 *
 * Every provider must implement these methods and properties.
 * See design.md for the full provider registry pattern.
 */
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

export interface SendParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ProviderConfigField {
  type: string;
  label: string;
  description: string;
  default?: string;
}

export interface ProviderConfigSchema {
  requiredKeys: string[];
  fields?: Record<string, ProviderConfigField>;
}

export interface NotificationProvider {
  name: string;
  channels: string[];
  getConfigSchema(): ProviderConfigSchema;
  send(params: SendParams, db: LibSQLDatabase): Promise<SendResult>;
}
