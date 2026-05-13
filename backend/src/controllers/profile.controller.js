'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { ok, notFound, badRequest } = require('../utils/response');
const { logActivity } = require('../utils/activity');

async function updateProfile(req, res) {
  const sb = supabaseAdmin();
  const patch = {};
  if (req.body.fullName !== undefined) patch.full_name = req.body.fullName;
  if (req.body.phone !== undefined) patch.phone = req.body.phone;
  if (req.body.state !== undefined) patch.state = req.body.state;
  if (req.body.lga !== undefined) patch.lga = req.body.lga;
  if (req.body.avatarUrl !== undefined) patch.avatar_url = req.body.avatarUrl;
  if (Object.keys(patch).length === 0) return badRequest(res, 'No fields to update');

  const { data, error } = await sb.from('profiles').update(patch).eq('user_id', req.user.userId).select().single();
  if (error) throw error;
  await logActivity({ actor: req.user, action: 'profile_updated', entityType: 'profile', entityId: req.user.userId, req });
  return ok(res, data);
}

async function deleteAccount(req, res) {
  const sb = supabaseAdmin();
  // Soft-suspend rather than hard delete to preserve audit trail
  await sb.from('profiles').update({ status: 'suspended' }).eq('user_id', req.user.userId);
  await sb.auth.admin.deleteUser(req.user.userId).catch(() => null);
  await logActivity({ actor: req.user, action: 'account_self_deleted', entityType: 'user', entityId: req.user.userId, req });
  return ok(res, { deleted: true });
}

/**
 * Export all data the field agent created (cooperatives + farmers).
 */
async function exportMyData(req, res) {
  const sb = supabaseAdmin();
  const [coops, farmers, deliveries, financings, repayments] = await Promise.all([
    sb.from('cooperatives').select('*').eq('created_by_agent_id', req.user.userId),
    sb.from('farmers').select(`*, farm_profiles(*)`).eq('created_by_agent_id', req.user.userId),
    sb.from('produce_deliveries').select('*').eq('logged_by_agent_id', req.user.userId),
    sb.from('financing_requests').select('*').eq('submitted_by_agent_id', req.user.userId),
    sb.from('repayment_records').select('*').eq('recorded_by_agent_id', req.user.userId),
  ]);
  return ok(res, {
    exportedAt: new Date().toISOString(),
    agent: { id: req.user.userId, email: req.user.email, fullName: req.user.fullName },
    cooperatives: coops.data || [],
    farmers: farmers.data || [],
    deliveries: deliveries.data || [],
    financingRequests: financings.data || [],
    repayments: repayments.data || [],
  });
}

module.exports = { updateProfile, deleteAccount, exportMyData };
