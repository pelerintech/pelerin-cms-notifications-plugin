/**
 * Template interpolation engine.
 *
 * Supports {{ field }} and {{ nested.field }} syntax.
 * Missing values are replaced with empty string.
 */

/**
 * Resolve a dot-separated path in a data object.
 * @param {Record<string, unknown>} data
 * @param {string} path - e.g., "a.b.c"
 * @returns {unknown}
 */
function resolvePath(data, path) {
  const parts = path.split('.');
  let current = data;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

/**
 * Interpolate a template string with data values.
 * @param {string} template - Template string with {{ field }} placeholders
 * @param {Record<string, unknown>} data - Data object to interpolate
 * @returns {string} Rendered string
 */
export function interpolate(template, data) {
  return template.replace(/\{\{\s*(\w+(?:\.\w+)*)\s*\}\}/g, (_, path) => {
    const value = resolvePath(data, path);
    return value !== undefined ? String(value) : '';
  });
}
