'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { ok } = require('../utils/response');

/**
 * Agent dashboard: cooperatives count, farmers count, recent activity,
 * pending/approved/rejected financing breakdown.
 *
 * Admin dashboard: global stats, risk distribution, agent counts,
 * pending applications, top cooperatives by score.
 *
 * Partner dashboard: forwarded loans, portfolio totals, risk distribution.
 */

async function agentDashboard(req, res) {
  const sb = supabaseAdmin();
  const userId = req.user.userId;

  const [coopCount, farmerCount, deliveryCount, financingByStatus, recentActivity] = await Promise.all([
    sb.from('cooperatives').select('id', { count: 'exact', head: true }).eq('created_by_agent_id', userId),
    sb.from('farmers').select('id', { count: 'exact', head: true }).eq('created_by_agent_id', userId),
    sb.from('produce_deliveries').select('id', { count: 'exact', head: true }).eq('logged_by_agent_id', userId),
    sb.from('financing_requests').select('id, status').eq('submitted_by_agent_id', userId),
    sb.from('activity_logs').select('*').eq('actor_id', userId).order('created_at', { ascending: false }).limit(15),
  ]);

  const financingCounts = { pending: 0, approved: 0, rejected: 0, disbursed: 0, completed: 0 };
  for (const r of financingByStatus.data || []) financingCounts[r.status] = (financingCounts[r.status] || 0) + 1;

  return ok(res, {
    cooperatives: coopCount.count || 0,
    farmers: farmerCount.count || 0,
    deliveries: deliveryCount.count || 0,
    financing: financingCounts,
    recentActivity: recentActivity.data || [],
  });
}

async function adminDashboard(req, res) {
  const sb = supabaseAdmin();

  const [farmers, cooperatives, agents, pendingApps, activeLoans, financing, coopTiers, recentActivity] = await Promise.all([
    sb.from('farmers').select('id', { count: 'exact', head: true }),
    sb.from('cooperatives').select('id', { count: 'exact', head: true }),
    sb.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'field_agent'),
    sb.from('agent_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('financing_requests').select('loan_amount, status').in('status', ['disbursed', 'approved']),
    sb.from('financing_requests').select('id, status'),
    sb.from('cooperative_credit_scores').select('cooperative_tier'),
    sb.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  const financingCounts = { pending: 0, approved: 0, rejected: 0, disbursed: 0, completed: 0 };
  for (const r of financing.data || []) financingCounts[r.status] = (financingCounts[r.status] || 0) + 1;

  const tierCounts = { A: 0, B: 0, C: 0, D: 0 };
  for (const r of coopTiers.data || []) if (r.cooperative_tier) tierCounts[r.cooperative_tier] += 1;

  const totalDisbursed = (activeLoans.data || []).reduce((s, r) => s + Number(r.loan_amount || 0), 0);

  return ok(res, {
    totals: {
      farmers: farmers.count || 0,
      cooperatives: cooperatives.count || 0,
      fieldAgents: agents.count || 0,
      pendingApplications: pendingApps.count || 0,
    },
    financing: financingCounts,
    totalDisbursed,
    cooperativeTierDistribution: tierCounts,
    recentActivity: recentActivity.data || [],
  });
}

async function partnerDashboard(req, res) {
  const sb = supabaseAdmin();
  const partnerId = req.user.partnerId;

  const [forwarded, approved, totalCoops, totalFarmers] = await Promise.all([
    sb.from('financing_requests').select('id, loan_amount, status, partner_decision, cooperative_id').eq('forwarded_to_partner_id', partnerId),
    sb.from('financing_requests').select('loan_amount').eq('forwarded_to_partner_id', partnerId).eq('partner_decision', 'approved'),
    sb.from('cooperatives').select('id', { count: 'exact', head: true }),
    sb.from('farmers').select('id', { count: 'exact', head: true }),
  ]);

  const totals = {
    requestsPending: 0,
    requestsApproved: 0,
    requestsRejected: 0,
    totalApprovedAmount: 0,
  };
  for (const r of forwarded.data || []) {
    if (r.partner_decision === 'approved') totals.requestsApproved += 1;
    else if (r.partner_decision === 'rejected') totals.requestsRejected += 1;
    else totals.requestsPending += 1;
  }
  totals.totalApprovedAmount = (approved.data || []).reduce((s, r) => s + Number(r.loan_amount || 0), 0);

  // Risk distribution from cooperatives that this partner financed
  const financedCoopIds = [...new Set((forwarded.data || []).map((r) => r.cooperative_id))];
  let riskDistribution = { A: 0, B: 0, C: 0, D: 0 };
  if (financedCoopIds.length) {
    const { data: tiers } = await sb
      .from('cooperative_credit_scores')
      .select('cooperative_tier')
      .in('cooperative_id', financedCoopIds);
    for (const r of tiers || []) if (r.cooperative_tier) riskDistribution[r.cooperative_tier] += 1;
  }

  return ok(res, {
    totals: {
      ...totals,
      cooperativesInSystem: totalCoops.count || 0,
      farmersInSystem: totalFarmers.count || 0,
    },
    riskDistribution,
  });
}

module.exports = { agentDashboard, adminDashboard, partnerDashboard };
