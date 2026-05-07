const { query } = require('../config/database');

async function getNotifications(req, res, next) {
  try {
    const { unread_only, page = 1, limit = 30 } = req.query;
    const conditions = ['n.user_id = $1'];
    const params = [req.user.id];
    let idx = 2;

    if (unread_only === 'true') {
      conditions.push(`n.is_read = FALSE`);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [countResult, dataResult] = await Promise.all([
      query(`SELECT COUNT(*) FROM notifications n WHERE ${whereClause}`, params),
      query(
        `SELECT n.id, n.title, n.message, n.type, n.reference_id, n.reference_type,
                n.is_read, n.created_at
         FROM notifications n
         WHERE ${whereClause}
         ORDER BY n.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, parseInt(limit), offset]
      )
    ]);

    const unreadCount = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );

    res.json({
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      unread_count: parseInt(unreadCount.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const { id } = req.params;
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    const result = await query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read', count: result.rowCount });
  } catch (err) {
    next(err);
  }
}

async function getUnreadCount(req, res, next) {
  try {
    const result = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ unread_count: parseInt(result.rows[0].count) });
  } catch (err) {
    next(err);
  }
}

module.exports = { getNotifications, markRead, markAllRead, getUnreadCount };
