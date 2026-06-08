/**
 * Templates list API endpoint.
 *
 * GET /api/plugins/notifications/templates
 * Query params: page, limit, search
 * Returns paginated list of notification templates.
 */

/**
 * GET handler for listing templates.
 * @param {Object} context - Astro API context
 * @returns {Response}
 */
export async function GET(context) {
  try {
    const url = new URL(context.request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const search = url.searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let templates = [];
    let total = 0;

    try {
      const { getTable } = await import('astro:db');
      const db = getTable('notification_templates');

      let query = db.orderBy('created_at', 'desc');
      if (search) {
        query = db.where('name', 'LIKE', `%${search}%`).orderBy('created_at', 'desc');
      }

      total = await query.count();
      templates = await query.limit(limit).offset(offset);
    } catch {
      // Astro DB not available — return empty structure
    }

    return new Response(
      JSON.stringify({
        data: templates,
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
