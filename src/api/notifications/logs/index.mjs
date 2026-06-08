/**
 * Logs list API endpoint.
 *
 * GET /api/plugins/notifications/logs
 * Query params: page, pageSize, provider, from, to, status, rule
 * Returns paginated list of notification log entries.
 */

/**
 * GET handler for listing logs.
 * @param {Object} context - Astro API context
 * @returns {Response}
 */
export async function GET(context) {
  try {
    const url = new URL(context.request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const provider = url.searchParams.get('provider') || '';
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';
    const status = url.searchParams.get('status') || '';
    const rule = url.searchParams.get('rule') || '';

    const offset = (page - 1) * pageSize;

    let logs = [];
    let total = 0;

    try {
      const { getTable } = await import('astro:db');
      const db = getTable('notification_logs');

      // Build base query with ordering
      let query = db.orderBy('created_at', 'desc');

      // Apply filters
      let conditions = [];
      if (provider) {
        conditions.push({ column: 'provider_name', operator: '=', value: provider });
      }
      if (from) {
        conditions.push({ column: 'created_at', operator: '>=', value: new Date(from) });
      }
      if (to) {
        conditions.push({ column: 'created_at', operator: '<=', value: new Date(to) });
      }
      if (status === 'success') {
        conditions.push({ column: 'success', operator: '=', value: true });
      } else if (status === 'failure') {
        conditions.push({ column: 'success', operator: '=', value: false });
      }
      if (rule) {
        conditions.push({ column: 'rule_id', operator: '=', value: rule });
      }

      // Apply conditions and paginate
      if (conditions.length > 0) {
        for (const cond of conditions) {
          query = query.where(cond.column, cond.operator, cond.value);
        }
      }

      total = await query.count();
      logs = await query.limit(pageSize).offset(offset);
    } catch {
      // Astro DB not available (e.g., during tests) — return empty structure
    }

    return new Response(
      JSON.stringify({
        data: logs,
        total,
        page,
        pageSize,
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
