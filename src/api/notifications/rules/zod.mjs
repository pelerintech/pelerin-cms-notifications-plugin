/**
 * Minimal Zod-like validation for API endpoints.
 *
 * Provides a subset of Zod's API for schema validation.
 * In production, replace with actual Zod: `import { z } from 'zod'`.
 */

class ZodString {
  constructor() {
    this._rules = [];
  }

  min(len) {
    this._rules.push({ type: 'min', len });
    return this;
  }

  validate(value) {
    if (typeof value !== 'string') return false;
    for (const rule of this._rules) {
      if (rule.type === 'min' && value.length < rule.len) return false;
    }
    return true;
  }
}

class ZodBoolean {
  validate(value) {
    return typeof value === 'boolean';
  }
}

class ZodObject {
  constructor(fields) {
    this._fields = fields;
  }

  safeParse(data) {
    const parsed = {};
    const issues = [];

    for (const [key, schema] of Object.entries(this._fields)) {
      if (schema._optional && !(key in data)) {
        continue;
      }
      if (schema._nullable && data[key] === null) {
        parsed[key] = null;
        continue;
      }
      if (!(key in data) && !schema._optional) {
        issues.push({ path: [key], message: `${key} is required` });
        continue;
      }
      if (key in data) {
        if (schema.validate(data[key])) {
          parsed[key] = data[key];
        } else {
          issues.push({ path: [key], message: `${key} is invalid` });
        }
      }
    }

    if (issues.length > 0) {
      return { success: false, error: { issues } };
    }
    return { success: true, data: parsed };
  }
}

export const z = {
  string: () => new ZodString(),
  boolean: () => new ZodBoolean(),
  object: (fields) => {
    const processed = {};
    for (const [key, schema] of Object.entries(fields)) {
      processed[key] = schema;
    }
    return new ZodObject(processed);
  },
};

// Monkey-patch optional/nullable
const origString = z.string;
z.string = function () {
  const s = origString();
  s.optional = () => { s._optional = true; return s; };
  s.nullable = () => { s._nullable = true; return s; };
  return s;
};

const origBoolean = z.boolean;
z.boolean = function () {
  const b = origBoolean();
  b.optional = () => { b._optional = true; return b; };
  b.nullable = () => { b._nullable = true; return b; };
  return b;
};
