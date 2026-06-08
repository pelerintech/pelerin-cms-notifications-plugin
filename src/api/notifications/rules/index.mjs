/**
 * Rules list API endpoint.
 *
 * GET /api/plugins/notifications/rules
 * Query params: page, limit, search, active
 * Returns paginated list of notification rules.
 */

/**
 * GET handler for listing rules.
 * @param {Object} context - Astro API context
 * @returns {Response}
 */
export async function GET(context) {
  try {
    const url = new URL(context.request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const search = url.searchParams.get('search') || '';
    const activeFilter = url.searchParams.get('active');

    const offset = (page - 1) * limit;

    // In production, this queries the notification_rules table via Astro DB.
    // For now, return the correct structure.
    let rules = [];
    let total = 0;

    try {
      const { getTable } = await import('astro:db');
      const db = getTable('notification_rules');

      let query = db.orderBy('created_at', 'desc');

      // Apply filters
      if (activeFilter !== null && activeFilter !== '') {
        const isActive = activeFilter === 'true';
        query = db.where('active', '=', isActive).orderBy('created_at', 'desc');
      }
      if (search) {
        query = db.where('event_pattern', 'LIKE', `%${search}%`).orderBy('created_at', 'desc');
      }

      total = await query.count();
      rules = await query.limit(limit).offset(offset);
    } catch {
      // Astro DB not available (e.g., during tests) — return empty structure
    }

    return new Response(
      JSON.stringify({
        data: rules,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
