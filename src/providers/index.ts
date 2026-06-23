/**
 * Providers index — imports all provider modules to trigger auto-registration.
 *
 * Re-exports registry functions for convenience.
 */
export { registerProvider, getProvider, listProviders } from './registry.ts';
export type { NotificationProvider, SendParams, SendResult, ProviderConfigSchema } from './interface.ts';

// Import each provider module to trigger auto-registration
import './sendgrid.ts';
import './mailgun.ts';
import './ses.ts';
import './smtp.ts';
import './local.ts';
import './brevo.ts';
