/**
 * Providers index — imports all provider modules to trigger auto-registration.
 *
 * Re-exports registry functions for convenience.
 */

export { registerProvider, getProvider, listProviders } from './registry.mjs';

// Import each provider module to trigger auto-registration
import './sendgrid.mjs';
import './mailgun.mjs';
import './ses.mjs';
import './smtp.mjs';
import './local.mjs';
import './brevo.mjs';
