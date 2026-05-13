'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { paginated } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

async function list(req, res) {
  const sb = supabaseAdmin();
  const { page, pageSize, from, to } = parsePagination(req.query);
  const { actorId, action, entityType } = req.query;
  let q = sb.from('activity_logs').select(`*, profiles:actor_id(full_name, email)`, { count: 'exact' });
  if (actorId) q = q.eq('actor_id', actorId);
  if (action) q = q.eq('action', action);
  if (entityType) q = q.eq('entity_type', entityType);
  q = q.order('created_at', { ascending: false }).range(from, to);
  const { data, count, error } = await q;
  if (error) throw error;
  return paginated(res, data || [], { page, pageSize, total: count || 0 });
}

module.exports = { list };
