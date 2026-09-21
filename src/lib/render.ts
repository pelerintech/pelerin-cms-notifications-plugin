/**
 * Template rendering seam.
 *
 * Wraps Handlebars behind a thin, testable `renderTemplate(template, payload)`
 * function. Supports `{{ field }}` (HTML-escaped), `{{{ field }}}` (raw HTML),
 * `{{#if}}`, `{{#each}}`, and registered helpers (`formatMoney`, `formatDate`).
 *
 * Templates are compiled once and cached in a module-level Map keyed by the
 * template string, so repeated dispatches for the same template don't recompile.
 * The compile function is injectable for tests (to count compilations).
 */
import Handlebars from 'handlebars';

// Custom helpers registered on a shared instance so all templates share them.
function formatMoney(value: unknown, currency: unknown, format?: unknown): string {
  const num = typeof value === 'number' ? value : Number(value);
  const cur = typeof currency === 'string' && currency ? currency : '';
  const mode = typeof format === 'string' ? format : 'code';
  // European-style grouping (1.250,00) using Intl with a fixed locale.
  const formatted = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(Number.isFinite(num) ? num : 0);
  if (mode === 'none') return formatted;
  if (mode === 'symbol') {
    // Use the currency's symbol when one is known; otherwise fall back to the
    // 3-letter ISO code (e.g. RON has no distinct glyph, so it renders as
    // "RON", never "lei").
    const symbols = new Map<string, string>([
      ['EUR', '€'],
      ['USD', '$'],
      ['GBP', '£'],
    ]);
    const symbol = symbols.get(cur) || cur;
    return `${formatted} ${symbol}`.trim();
  }
  // default: code
  return `${formatted} ${cur}`.trim();
}

/**
 * Convert a monetary value given in minor units (cents / bani, e.g. 12500 for
 * 125,00) to major units (divide by 100). Compose it with {@link formatMoney}
 * in a template to render the whole-currency amount, e.g.
 * `{{ formatMoney (minorToMajor data.order.total) data.order.currency }}`.
 * Non-numeric input yields NaN, which `formatMoney` renders as `0,00`.
 */
function minorToMajor(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  return num / 100;
}

function formatDate(iso: unknown, format?: unknown): string {
  const date = new Date(typeof iso === 'string' ? iso : '');
  if (Number.isNaN(date.getTime())) return '';
  const fmt = typeof format === 'string' && format ? format : 'dd/MM/yyyy';
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const dd = pad(date.getDate());
  const MM = pad(date.getMonth() + 1);
  const yy = String(date.getFullYear()).slice(-2);
  const yyyy = String(date.getFullYear());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return fmt
    .replace(/dd/g, dd)
    .replace(/MM/g, MM)
    .replace(/yyyy/g, yyyy)
    .replace(/yy/g, yy)
    .replace(/HH/g, HH)
    .replace(/mm/g, mm);
}

// A compile function keyed by template string; injectable for tests.
export type CompileFn = (template: string) => (data: unknown) => string;

let compileFn: CompileFn = (template: string) => {
  const compiled = Handlebars.compile(template);
  return (data: unknown) => compiled(data);
};

/** For tests: replace the compile function (e.g. to count compilations). */
export function setCompileFn(fn: CompileFn): void {
  compileFn = fn;
}

/** For tests: restore the default Handlebars compile function. */
export function resetCompileFn(): void {
  compileFn = (template: string) => {
    const compiled = Handlebars.compile(template);
    return (data: unknown) => compiled(data);
  };
}

// Register helpers once on the shared Handlebars instance.
Handlebars.registerHelper('formatMoney', formatMoney);
Handlebars.registerHelper('minorToMajor', minorToMajor);
Handlebars.registerHelper('formatDate', formatDate);
// `helperMissing` is Handlebars' fallback for an unregistered helper invoked
// with arguments (e.g. `{{ noSuchHelper x }}`). Registering it once (a static
// name, no dynamic registration) makes unknown helpers resolve to empty output
// instead of throwing a runtime "Missing helper" error, so a typo'd helper in a
// template renders as empty/missing rather than crashing the dispatch. Known
// helpers (built-ins + formatMoney/formatDate) never reach this fallback.
Handlebars.registerHelper('helperMissing', () => '');

const cache = new Map<string, (data: unknown) => string>();

/** Render a template string with a payload object using Handlebars. */
export function renderTemplate(template: string, payload: Record<string, unknown>): string {
  let render = cache.get(template);
  if (!render) {
    render = compileFn(template);
    cache.set(template, render);
  }
  return render(payload);
}

/**
 * Detect whether a recipient field contains block (`{{#if}}`, `{{#each}}`)
 * or helper (`{{ name arg }}`) syntax, which is disallowed for recipients.
 * Only plain `{{ path }}` / `{{{ path }}}` substitution is allowed.
 */
export function hasBlockSyntax(field: string): boolean {
  // Block openers ({{#if}}) and closers ({{/each}}).
  if (/\{\{[#/]/.test(field)) return true;
  // Match each {{ ... }} or {{{ ... }}} expression (no nested braces).
  const exprRe = /\{\{\{?[^{}]*?\}\}\}?/g;
  let m: RegExpExecArray | null;
  while ((m = exprRe.exec(field)) !== null) {
    const trimmed = m[0]
      .replace(/^\{\{\{\s*/, '')
      .replace(/^\{\{\s*/, '')
      .replace(/\s*}}}$/, '')
      .replace(/\s*}}/, '')
      .trim();
    if (!trimmed) continue;
    // A plain path (data.order.email) has no internal whitespace; a helper
    // call (formatMoney x) has arguments separated by whitespace.
    if (/\s/.test(trimmed)) return true;
  }
  return false;
}

/**
 * Resolve a recipient field, restricted to plain `{{ }}` / `{{{ }}}`
 * substitution (no blocks, no helpers). Throws if disallowed syntax is used.
 */
export function renderRecipient(field: string, payload: Record<string, unknown>): string {
  if (hasBlockSyntax(field)) {
    throw new Error('Recipient field may only use plain {{ }} substitution (no blocks or helpers)');
  }
  return renderTemplate(field, payload);
}
