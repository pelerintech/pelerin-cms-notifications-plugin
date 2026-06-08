/**
 * Provider settings API endpoint.
 *
 * POST /api/plugins/notifications/providers/[name]/settings — save encrypted credentials
 * GET  /api/plugins/notifications/providers/[name]/settings — retrieve decrypted values
 */

/**
 * Simple encryption/decryption placeholder.
 * In production, use the same decryptIfNeeded pattern from the shop plugin.
 */
const ENCRYPTION_KEY = process.env.NOTIFICATION_ENCRYPTION_KEY || 'default-dev-key-change-in-production';

function encrypt(value) {
  // In production, use proper AES encryption
  // Placeholder: base64 encode (NOT secure, for dev only)
  return Buffer.from(JSON.stringify({ v: value, k: ENCRYPTION_KEY })).toString('base64');
}

function decrypt(encrypted) {
  try {
    const decoded = JSON.parse(Buffer.from(encrypted, 'base64').toString('utf8'));
    if (decoded.k !== ENCRYPTION_KEY) {
      return null;
    }
    return decoded.v;
  } catch {
    return null;
  }
}

// In-memory store for settings (replaced by DB in production)
const _settingsStore = new Map();

/**
 * GET handler for retrieving provider settings.
 * @param {Object} context - Astro API context with params.name
 * @returns {Response}
 */
export async function GET(context) {
  try {
    const { name } = context.params;
    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Provider name is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Fetch settings from DB or in-memory store
    let settings = {};
    try {
      const { getTable } = await import('astro:db');
      const db = getTable('notification_settings');
      const rows = await db.where('key', 'LIKE', `${name}_%`).run();
      for (const row of rows) {
        const key = row.key.replace(`${name}_`, '');
        settings[key] = decrypt(row.value) || row.value;
      }
    } catch {
      // Astro DB not available — use in-memory store
      for (const [key, value] of _settingsStore.entries()) {
        if (key.startsWith(`${name}_`)) {
          const cleanKey = key.replace(`${name}_`, '');
          settings[cleanKey] = decrypt(value) || value;
        }
      }
    }

    return new Response(
      JSON.stringify({ data: settings, provider: name }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

/**
 * POST handler for saving provider settings.
 * @param {Object} context - Astro API context with params.name
 * @returns {Response}
 */
export async function POST(context) {
  try {
    const { name } = context.params;
    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Provider name is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const body = await context.request.json();

    // Save each setting key/value pair (encrypted)
    const saved = {};
    for (const [key, value] of Object.entries(body)) {
      const fullKey = `${name}_${key}`;
      const encrypted = encrypt(String(value));
      saved[key] = true;

      // In-memory store
      _settingsStore.set(fullKey, encrypted);

      // In production, save to notification_settings table via Astro DB
      try {
        const { getTable } = await import('astro:db');
        const db = getTable('notification_settings');
        const existing = await db.where('key', '=', fullKey).run();
        if (existing.length > 0) {
          await db.update(existing[0].id, { value: encrypted });
        } else {
          await db.insert({
            id: `setting_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            key: fullKey,
            value: encrypted,
            created_at: new Date(),
          });
        }
      } catch {
        // Astro DB not available
      }
    }

    return new Response(
      JSON.stringify({ data: { provider: name, saved }, message: 'Settings saved successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
