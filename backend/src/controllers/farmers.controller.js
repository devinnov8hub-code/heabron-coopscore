'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { ok, created, notFound, forbidden, paginated, badRequest } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../utils/activity');
const { ADMIN_ROLES } = require('../middleware/auth');
const ninService = require('../services/nin');
const { safeRecalculateFarmer } = require('../services/credit-score');

function farmerRow(input, userId) {
  return {
    cooperative_id: input.cooperativeId,
    full_name: input.fullName,
    date_of_birth: input.dateOfBirth,
    gender: input.gender,
    phone: input.phone,
    alt_phone: input.altPhone,
    address: input.address,
    state: input.state,
    lga: input.lga,
    household_size: input.householdSize,
    dependents: input.dependents,
    education_level: input.educationLevel,
    nin: input.nin,
    bvn: input.bvn,
    id_image_url: input.idImageUrl,
    farmer_photo_url: input.farmerPhotoUrl,
    created_by_agent_id: userId,
  };
}

function farmRow(farmerId, farm) {
  return {
    farmer_id: farmerId,
    farm_size_acres: farm.farmSizeAcres,
    crop_type: farm.cropType,
    secondary_crops: farm.secondaryCrops || null,
    soil_type: farm.soilType,
    irrigation_access: !!farm.irrigationAccess,
    water_source: farm.waterSource,
    land_ownership: farm.landOwnership,
    years_experience: farm.yearsExperience || 0,
    gps_lat: farm.gpsLat,
    gps_lng: farm.gpsLng,
    gps_polygon: farm.gpsPolygon || null,
    land_document_url: farm.landDocumentUrl,
    land_document_type: farm.landDocumentType,
    farm_photo_urls: farm.farmPhotoUrls || null,
  };
}

async function list(req, res) {
  const sb = supabaseAdmin();
  const { page, pageSize, from, to } = parsePagination(req.query);
  const { search, cooperativeId, tier, state, lga, agentId } = req.query;

  let q = sb.from('farmers').select(
    `*, cooperatives(id, name), farm_profiles(crop_type, farm_size_acres), credit_scores(final_credit_score, credit_tier)`,
    { count: 'exact' }
  );

  if (req.user.role === 'field_agent') {
    q = q.eq('created_by_agent_id', req.user.userId);
  } else if (ADMIN_ROLES.includes(req.user.role) && agentId) {
    q = q.eq('created_by_agent_id', agentId);
  }
  if (cooperativeId) q = q.eq('cooperative_id', cooperativeId);
  if (search) q = q.ilike('full_name', `%${search}%`);
  if (state) q = q.eq('state', state);
  if (lga) q = q.eq('lga', lga);
  if (tier) q = q.eq('credit_tier', tier);

  q = q.order('created_at', { ascending: false }).range(from, to);
  const { data, count, error } = await q;
  if (error) throw error;
  return paginated(res, data || [], { page, pageSize, total: count || 0 });
}

async function getById(req, res) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('farmers')
    .select(`*, cooperatives(id, name, state, lga), farm_profiles(*), credit_scores(*)`)
    .eq('id', req.params.farmerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return notFound(res);
  if (req.user.role === 'field_agent' && data.created_by_agent_id !== req.user.userId) return forbidden(res);
  return ok(res, data);
}

async function create(req, res) {
  const sb = supabaseAdmin();
  const row = farmerRow(req.body, req.user.userId);
  const { data: farmer, error } = await sb.from('farmers').insert(row).select().single();
  if (error) throw error;

  if (req.body.farm) {
    await sb.from('farm_profiles').insert(farmRow(farmer.id, req.body.farm));
  }

  // Best-effort NIN verification if NIN is provided
  if (req.body.nin) {
    const nameParts = req.body.fullName.split(/\s+/);
    const result = await ninService.verifyNin({
      nin: req.body.nin,
      firstName: nameParts[0],
      lastName: nameParts.slice(-1)[0],
      dateOfBirth: req.body.dateOfBirth,
    });
    await sb.from('farmers').update({
      nin_verification_status: result.status,
      nin_verification_payload: result.raw,
      verified_at: result.status === 'verified' ? new Date().toISOString() : null,
      verified_by_agent_id: result.status === 'verified' ? req.user.userId : null,
    }).eq('id', farmer.id);
  }

  // Cooperative member count + initial first-cycle score
  await sb.rpc('update_cooperative_member_count', { p_cooperative_id: row.cooperative_id }).catch(() => null);
  safeRecalculateFarmer(farmer.id, { triggerReason: 'farmer_created' });

  await sb.from('notifications').insert({
    user_id: req.user.userId,
    type: 'farmer_added',
    title: 'Farmer added',
    message: `${farmer.full_name} was added`,
    metadata: { farmerId: farmer.id, cooperativeId: row.cooperative_id },
  });

  await logActivity({ actor: req.user, action: 'farmer_created', entityType: 'farmer', entityId: farmer.id, metadata: { name: farmer.full_name }, req });
  return created(res, farmer);
}

async function update(req, res) {
  const sb = supabaseAdmin();
  const { data: existing } = await sb.from('farmers').select('id, created_by_agent_id').eq('id', req.params.farmerId).maybeSingle();
  if (!existing) return notFound(res);
  if (req.user.role === 'field_agent' && existing.created_by_agent_id !== req.user.userId) return forbidden(res);

  const patch = farmerRow(req.body, existing.created_by_agent_id);
  delete patch.created_by_agent_id;
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  const { data, error } = await sb.from('farmers').update(patch).eq('id', existing.id).select().single();
  if (error) throw error;

  if (req.body.farm) {
    const farm = farmRow(existing.id, req.body.farm);
    const { data: fp } = await sb.from('farm_profiles').select('id').eq('farmer_id', existing.id).maybeSingle();
    if (fp) await sb.from('farm_profiles').update(farm).eq('id', fp.id);
    else await sb.from('farm_profiles').insert(farm);
  }

  safeRecalculateFarmer(existing.id, { triggerReason: 'farmer_updated' });
  await logActivity({ actor: req.user, action: 'farmer_updated', entityType: 'farmer', entityId: existing.id, req });
  return ok(res, data);
}

async function remove(req, res) {
  const sb = supabaseAdmin();
  const { data: existing } = await sb.from('farmers').select('id, full_name, created_by_agent_id, cooperative_id').eq('id', req.params.farmerId).maybeSingle();
  if (!existing) return notFound(res);
  if (req.user.role === 'field_agent' && existing.created_by_agent_id !== req.user.userId) return forbidden(res);
  await sb.from('farmers').delete().eq('id', existing.id);
  await logActivity({ actor: req.user, action: 'farmer_deleted', entityType: 'farmer', entityId: existing.id, metadata: { name: existing.full_name }, req });
  return ok(res, { deleted: true });
}

async function verifyNin(req, res) {
  const sb = supabaseAdmin();
  const { data: farmer } = await sb.from('farmers').select('*').eq('id', req.params.farmerId).maybeSingle();
  if (!farmer) return notFound(res);
  if (req.user.role === 'field_agent' && farmer.created_by_agent_id !== req.user.userId) return forbidden(res);
  if (!farmer.nin) return badRequest(res, 'No NIN on file for this farmer');

  const nameParts = (farmer.full_name || '').split(/\s+/);
  const result = await ninService.verifyNin({
    nin: farmer.nin,
    firstName: nameParts[0],
    lastName: nameParts.slice(-1)[0],
    dateOfBirth: farmer.date_of_birth,
  });
  await sb.from('farmers').update({
    nin_verification_status: result.status,
    nin_verification_payload: result.raw,
    verified_at: result.status === 'verified' ? new Date().toISOString() : null,
    verified_by_agent_id: result.status === 'verified' ? req.user.userId : null,
  }).eq('id', farmer.id);
  return ok(res, { status: result.status, details: result.details });
}

async function getCreditScore(req, res) {
  const sb = supabaseAdmin();
  const { data: score } = await sb
    .from('credit_scores')
    .select('*')
    .eq('farmer_id', req.params.farmerId)
    .maybeSingle();
  const { data: history } = await sb
    .from('credit_score_history')
    .select('*')
    .eq('farmer_id', req.params.farmerId)
    .order('calculated_at', { ascending: false })
    .limit(20);
  return ok(res, { current: score || null, history: history || [] });
}

async function recalculateScore(req, res) {
  const result = await safeRecalculateFarmer(req.params.farmerId, { triggerReason: 'manual_recalc' });
  return ok(res, result);
}

module.exports = { list, getById, create, update, remove, verifyNin, getCreditScore, recalculateScore };
