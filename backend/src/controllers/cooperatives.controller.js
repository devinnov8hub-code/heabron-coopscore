'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { ok, created, notFound, forbidden, paginated } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../utils/activity');
const { ADMIN_ROLES } = require('../middleware/auth');

function toRow(input, userId) {
  return {
    name: input.name,
    registration_number: input.registrationNumber,
    leader_name: input.leaderName,
    leader_phone: input.leaderPhone,
    crops_supported: input.cropsSupported,
    state: input.state,
    lga: input.lga,
    address: input.address,
    estimated_land_size: input.estimatedLandSize,
    logo_url: input.logoUrl,
    gps_lat: input.gpsLat,
    gps_lng: input.gpsLng,
    gps_polygon: input.gpsPolygon || null,
    created_by_agent_id: userId,
  };
}

async function list(req, res) {
  const sb = supabaseAdmin();
  const { page, pageSize, from, to } = parsePagination(req.query);
  const { search, state, lga, crop, agentId } = req.query;

  let q = sb.from('cooperatives').select(
    `*, cooperative_credit_scores(average_score, cooperative_tier, total_farmers)`,
    { count: 'exact' }
  );

  if (req.user.role === 'field_agent') {
    q = q.eq('created_by_agent_id', req.user.userId);
  } else if (ADMIN_ROLES.includes(req.user.role) && agentId) {
    q = q.eq('created_by_agent_id', agentId);
  }
  if (search) q = q.ilike('name', `%${search}%`);
  if (state) q = q.eq('state', state);
  if (lga) q = q.eq('lga', lga);
  if (crop) q = q.contains('crops_supported', [crop]);

  q = q.order('created_at', { ascending: false }).range(from, to);

  const { data, count, error } = await q;
  if (error) throw error;
  return paginated(res, data || [], { page, pageSize, total: count || 0 });
}

async function getById(req, res) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('cooperatives')
    .select(`*, cooperative_credit_scores(*)`)
    .eq('id', req.params.cooperativeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return notFound(res, 'Cooperative not found');
  if (req.user.role === 'field_agent' && data.created_by_agent_id !== req.user.userId) {
    return forbidden(res, 'You did not create this cooperative');
  }

  // Counts: farmers, deliveries (last 30d), financing requests
  const [{ count: farmersCount }, { count: deliveriesCount }, { count: financingCount }] = await Promise.all([
    sb.from('farmers').select('id', { count: 'exact', head: true }).eq('cooperative_id', data.id),
    sb.from('produce_deliveries').select('id', { count: 'exact', head: true }).eq('cooperative_id', data.id),
    sb.from('financing_requests').select('id', { count: 'exact', head: true }).eq('cooperative_id', data.id),
  ]);

  return ok(res, {
    ...data,
    stats: {
      farmers: farmersCount || 0,
      deliveries: deliveriesCount || 0,
      financingRequests: financingCount || 0,
    },
  });
}

async function create(req, res) {
  const sb = supabaseAdmin();
  const row = toRow(req.body, req.user.userId);
  const { data, error } = await sb.from('cooperatives').insert(row).select().single();
  if (error) throw error;

  await sb.from('notifications').insert({
    user_id: req.user.userId,
    type: 'cooperative_added',
    title: 'Cooperative created',
    message: `You added "${data.name}"`,
    metadata: { cooperativeId: data.id },
  });

  await logActivity({ actor: req.user, action: 'cooperative_created', entityType: 'cooperative', entityId: data.id, metadata: { name: data.name }, req });
  return created(res, data);
}

async function update(req, res) {
  const sb = supabaseAdmin();
  const { data: existing } = await sb.from('cooperatives').select('id, created_by_agent_id').eq('id', req.params.cooperativeId).maybeSingle();
  if (!existing) return notFound(res);
  if (req.user.role === 'field_agent' && existing.created_by_agent_id !== req.user.userId) return forbidden(res);

  const patch = toRow(req.body, existing.created_by_agent_id);
  delete patch.created_by_agent_id;
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  const { data, error } = await sb.from('cooperatives').update(patch).eq('id', req.params.cooperativeId).select().single();
  if (error) throw error;
  await logActivity({ actor: req.user, action: 'cooperative_updated', entityType: 'cooperative', entityId: data.id, req });
  return ok(res, data);
}

async function remove(req, res) {
  const sb = supabaseAdmin();
  const { data: existing } = await sb.from('cooperatives').select('id, created_by_agent_id, name').eq('id', req.params.cooperativeId).maybeSingle();
  if (!existing) return notFound(res);
  if (req.user.role === 'field_agent' && existing.created_by_agent_id !== req.user.userId) return forbidden(res);

  await sb.from('cooperatives').delete().eq('id', req.params.cooperativeId);
  await logActivity({ actor: req.user, action: 'cooperative_deleted', entityType: 'cooperative', entityId: existing.id, metadata: { name: existing.name }, req });
  return ok(res, { deleted: true });
}

async function listFarmers(req, res) {
  const sb = supabaseAdmin();
  const { page, pageSize, from, to } = parsePagination(req.query);
  const { count, data, error } = await sb
    .from('farmers')
    .select('*', { count: 'exact' })
    .eq('cooperative_id', req.params.cooperativeId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return paginated(res, data || [], { page, pageSize, total: count || 0 });
}

module.exports = { list, getById, create, update, remove, listFarmers };
