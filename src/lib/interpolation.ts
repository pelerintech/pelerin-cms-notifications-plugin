/**
 * Template interpolation engine.
 *
 * Supports {{ field }} and {{ nested.field }} syntax.
 * Missing values are replaced with empty string.
 */

/** Resolve a dot-separated path in a data object. */
function resolvePath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = data;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Interpolate a template string with data values. */
export function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*(\w+(?:\.\w+)*)\s*\}\}/g, (_, path: string) => {
    const value = resolvePath(data, path);
    return value !== undefined ? String(value) : '';
  });
}
