/**
 * Provider selection — chooses the correct provider based on dev mode.
 *
 * When dev mode is enabled, returns the local provider regardless of the rule's provider.
 * When dev mode is disabled, returns the rule's configured provider.
 */

import { getProvider } from '../providers/registry.mjs';

/**
 * Get the provider to use for a given rule.
 * @param {Object} rule - Notification rule with provider_name
 * @param {boolean} isDev - Whether dev mode is enabled
 * @returns {Object|null} Provider instance or null if not found
 */
export function getProviderForRule(rule, isDev) {
  if (isDev) {
    return getProvider('local');
  }
  return getProvider(rule.provider_name);
}
