/**
 * Data accessors barrel — re-exports all domain accessor modules.
 *
 * All DB access in the plugin goes through these functions. Each receives
 * `db: LibSQLDatabase` as its first parameter and imports table objects from
 * `src/db/schema.ts`.
 */
export {
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  findActiveRulesMatching,
  RuleError,
  type RuleRow,
  type CreateRuleInput,
  type UpdateRuleInput,
  type ListRulesOptions,
  type ListRulesResult,
} from './rules.ts';

export {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  TemplateError,
  type TemplateRow,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type ListTemplatesOptions,
  type ListTemplatesResult,
} from './templates.ts';

export {
  listLogs,
  getLog,
  createLog,
  type LogRow,
  type CreateLogInput,
  type ListLogsOptions,
  type ListLogsResult,
} from './logs.ts';

export { getSetting, setSetting, listSettingsForProvider } from './settings.ts';

export { isProviderConfigured } from './providers.ts';
