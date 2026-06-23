/**
 * Provider selection — chooses the correct provider based on dev mode.
 *
 * When dev mode is enabled, returns the local provider regardless of the rule's provider.
 * When dev mode is disabled, returns the rule's configured provider.
 */
import { getProvider } from '../providers/registry.ts';
import type { NotificationProvider } from '../providers/interface.ts';

export interface RuleProviderInfo {
  provider_name: string;
}

/** Get the provider to use for a given rule. */
export function getProviderForRule(rule: RuleProviderInfo, isDev: boolean): NotificationProvider | null {
  if (isDev) {
    return getProvider('local');
  }
  return getProvider(rule.provider_name);
}
