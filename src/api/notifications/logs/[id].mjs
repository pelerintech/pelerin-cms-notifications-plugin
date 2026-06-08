/**
 * Logs detail API endpoint.
 *
 * GET /api/plugins/notifications/logs/[id]
 * Returns a single notification log entry by ID.
 */

/**
 * GET handler for fetching a single log entry.
 * @param {Object} context - Astro API context with params.id
 * @returns {Response}
 */
export async function GET(context) {
  try {
    const { id } = context.params;
    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Log entry ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    try {
      const { getTable } = await import('astro:db');
      const db = getTable('notification_logs');
      const logEntry = await db.findFirst({ where: { id: '=', value: id } });

      if (!logEntry) {
        return new Response(
          JSON.stringify({ error: 'Log entry not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ data: logEntry }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    } catch {
      // Astro DB not available (e.g., during tests)
      return new Response(
        JSON.stringify({ error: 'Log entry not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
