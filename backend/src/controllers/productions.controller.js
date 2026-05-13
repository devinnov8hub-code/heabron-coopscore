'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { ok, created, notFound, forbidden, paginated } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../utils/activity');
const { safeRecalculateFarmer } = require('../services/credit-score');

async function list(req, res) {
  const sb = supabaseAdmin();
  const { page, pageSize, from, to } = parsePagination(req.query);
  const { farmerId, crop, season } = req.query;
  let q = sb.from('seasonal_productions').select('*, farmers(id, full_name)', { count: 'exact' });
  if (farmerId) q = q.eq('farmer_id', farmerId);
  if (crop) q = q.eq('crop', crop);
  if (season) q = q.eq('season', season);
  q = q.order('expected_harvest_date', { ascending: false }).range(from, to);
  const { data, count, error } = await q;
  if (error) throw error;
  return paginated(res, data || [], { page, pageSize, total: count || 0 });
}

async function create(req, res) {
  const sb = supabaseAdmin();
  const body = req.body;
  const { data: farmer } = await sb.from('farmers').select('id, created_by_agent_id').eq('id', body.farmerId).maybeSingle();
  if (!farmer) return notFound(res, 'Farmer not found');
  if (req.user.role === 'field_agent' && farmer.created_by_agent_id !== req.user.userId) return forbidden(res);

  let yieldRatio = null;
  if (body.actualYieldTonnes && body.benchmarkYieldTonnes) {
    yieldRatio = Math.min(Number(body.actualYieldTonnes) / Number(body.benchmarkYieldTonnes), 1.0);
  }

  const { data, error } = await sb.from('seasonal_productions').insert({
    farmer_id: body.farmerId,
    cycle_number: body.cycleNumber || 1,
    season: body.season,
    crop: body.crop,
    expected_planting_date: body.expectedPlantingDate,
    expected_harvest_date: body.expectedHarvestDate,
    expected_yield_tonnes: body.expectedYieldTonnes,
    actual_yield_tonnes: body.actualYieldTonnes,
    benchmark_yield_tonnes: body.benchmarkYieldTonnes,
    yield_ratio: yieldRatio,
    yield_verified_by_agent: !!body.actualYieldTonnes,
    notes: body.notes,
  }).select().single();
  if (error) throw error;

  if (body.actualYieldTonnes) {
    safeRecalculateFarmer(body.farmerId, { triggerReason: 'production_recorded' });
  }

  await logActivity({ actor: req.user, action: 'production_recorded', entityType: 'production', entityId: data.id, req });
  return created(res, data);
}

module.exports = { list, create };
