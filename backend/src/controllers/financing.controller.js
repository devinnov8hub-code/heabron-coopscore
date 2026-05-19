'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { ok, created, notFound, forbidden, paginated, badRequest } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../utils/activity');
const { ADMIN_ROLES, PARTNER_ROLES } = require('../middleware/auth');
const email = require('../services/email');
const config = require('../config');
const logger = require('../utils/logger');

function shapeRequest(input, agentId) {
  return {
    cooperative_id: input.cooperativeId,
    farmer_id: input.farmerId || null,
    loan_amount: input.loanAmount,
    purpose: input.purpose,
    season: input.season,
    repayment_window_days: input.repaymentWindowDays || 180,
    submitted_by_agent_id: agentId,
    status: 'pending',
  };
}

async function getProfileFor(sb, userId) {
  if (!userId) return null;
  const { data } = await sb.from('profiles').select('email, full_name').eq('user_id', userId).maybeSingle();
  return data || null;
}

async function getProfilesForMany(sb, userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data } = await sb.from('profiles').select('user_id, email, full_name').in('user_id', ids);
  return new Map((data || []).map((p) => [p.user_id, p]));
}

async function list(req, res) {
  const sb = supabaseAdmin();
  const { page, pageSize, from, to } = parsePagination(req.query);
  const { status, cooperativeId, farmerId } = req.query;

  let q = sb.from('financing_requests').select(
    `*, cooperatives(id, name, cooperative_tier, average_credit_score), farmers(id, full_name, credit_tier)`,
    { count: 'exact' }
  );

  if (req.user.role === 'field_agent') q = q.eq('submitted_by_agent_id', req.user.userId);
  if (PARTNER_ROLES.includes(req.user.role)) q = q.eq('forwarded_to_partner_id', req.user.partnerId);
  if (status) q = q.eq('status', status);
  if (cooperativeId) q = q.eq('cooperative_id', cooperativeId);
  if (farmerId) q = q.eq('farmer_id', farmerId);

  q = q.order('created_at', { ascending: false }).range(from, to);
  const { data, count, error } = await q;
  if (error) throw error;
  return paginated(res, data || [], { page, pageSize, total: count || 0 });
}

async function getById(req, res) {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from('financing_requests')
    .select(`*, cooperatives(*), farmers(*), repayment_records(*)`)
    .eq('id', req.params.requestId)
    .maybeSingle();
  if (!data) return notFound(res);

  if (req.user.role === 'field_agent' && data.submitted_by_agent_id !== req.user.userId) return forbidden(res);
  if (PARTNER_ROLES.includes(req.user.role) && data.forwarded_to_partner_id !== req.user.partnerId) return forbidden(res);
  return ok(res, data);
}

async function create(req, res) {
  const sb = supabaseAdmin();

  const { data: coop } = await sb.from('cooperatives').select('id, created_by_agent_id, name').eq('id', req.body.cooperativeId).maybeSingle();
  if (!coop) return notFound(res, 'Cooperative not found');
  if (req.user.role === 'field_agent' && coop.created_by_agent_id !== req.user.userId) return forbidden(res);

  const row = shapeRequest(req.body, req.user.userId);
  const { data, error } = await sb.from('financing_requests').insert(row).select().single();
  if (error) {
    logger.error({ err: error.message, code: error.code, hint: error.hint, details: error.details }, 'financing_requests insert failed');
    throw error;
  }

  try {
    const { data: admins } = await sb.from('user_roles').select('user_id').eq('role', 'super_admin');
    const adminProfiles = await getProfilesForMany(sb, (admins || []).map((a) => a.user_id));
    const farmerName = req.body.farmerId
      ? (await sb.from('farmers').select('full_name').eq('id', req.body.farmerId).maybeSingle()).data?.full_name
      : null;

    if (admins?.length) {
      await sb.from('notifications').insert(admins.map((a) => ({
        user_id: a.user_id,
        type: 'financing_request_submitted',
        title: 'New financing request',
        message: `${coop.name} requested ₦${Number(row.loan_amount).toLocaleString()}`,
        metadata: { financingRequestId: data.id },
      })));
      for (const a of admins) {
        const p = adminProfiles.get(a.user_id);
        if (p?.email) {
          email.safe(email.sendFinancingSubmittedToAdmin)(p.email, {
            adminName: p.full_name,
            cooperativeName: coop.name,
            farmerName,
            amount: row.loan_amount,
            agentName: req.user.fullName,
          });
        }
      }
    }
  } catch (e) {
    logger.warn({ err: e.message }, 'financing admin notifications failed');
  }

  await logActivity({ actor: req.user, action: 'financing_request_submitted', entityType: 'financing_request', entityId: data.id, req });
  return created(res, data);
}

async function adminDecide(req, res) {
  const sb = supabaseAdmin();
  const { decision, approvedAmount, dueDate, rejectionReason, forwardToPartnerId, adminComments } = req.body;

  const { data: existing } = await sb
    .from('financing_requests')
    .select('*, cooperatives(id, name), farmers(id, full_name, phone)')
    .eq('id', req.params.requestId)
    .maybeSingle();
  if (!existing) return notFound(res);

  const submitterProfile = await getProfileFor(sb, existing.submitted_by_agent_id);

  if (decision === 'rejected') {
    await sb.from('financing_requests').update({
      status: 'rejected',
      rejection_reason: rejectionReason,
      admin_comments: adminComments,
      reviewed_by_admin_id: req.user.userId,
    }).eq('id', existing.id);

    if (submitterProfile?.email) {
      email.safe(email.sendFinancingRejected)(submitterProfile.email, {
        recipientName: submitterProfile.full_name,
        cooperativeName: existing.cooperatives?.name,
        amount: existing.loan_amount,
        reason: rejectionReason,
      });
    }
    await sb.from('notifications').insert({
      user_id: existing.submitted_by_agent_id,
      type: 'financing_rejected',
      title: 'Financing rejected',
      message: `Request for ${existing.cooperatives?.name} was rejected`,
      metadata: { financingRequestId: existing.id },
    });
  } else if (decision === 'approved') {
    const partnerId = forwardToPartnerId || null;
    const patch = {
      status: 'approved',
      approved_amount: approvedAmount || existing.loan_amount,
      due_date: dueDate || null,
      admin_comments: adminComments,
      reviewed_by_admin_id: req.user.userId,
    };
    if (partnerId) patch.forwarded_to_partner_id = partnerId;
    await sb.from('financing_requests').update(patch).eq('id', existing.id);

    if (submitterProfile?.email) {
      email.safe(email.sendFinancingApproved)(submitterProfile.email, {
        recipientName: submitterProfile.full_name,
        cooperativeName: existing.cooperatives?.name,
        amount: patch.approved_amount,
        dueDate: patch.due_date,
      });
    }
    await sb.from('notifications').insert({
      user_id: existing.submitted_by_agent_id,
      type: 'financing_approved',
      title: 'Financing approved',
      message: `Request for ${existing.cooperatives?.name} was approved`,
      metadata: { financingRequestId: existing.id },
    });

    if (partnerId) {
      try {
        const { data: partnerUsers } = await sb.from('user_roles').select('user_id').eq('partner_id', partnerId);
        const partnerProfiles = await getProfilesForMany(sb, (partnerUsers || []).map((pu) => pu.user_id));
        const { data: partner } = await sb.from('partners').select('organization_name').eq('id', partnerId).maybeSingle();
        for (const pu of partnerUsers || []) {
          const pp = partnerProfiles.get(pu.user_id);
          if (pp?.email) {
            email.safe(email.sendFinancingForwardedToPartner)(pp.email, {
              partnerName: partner?.organization_name,
              cooperativeName: existing.cooperatives?.name,
              amount: patch.approved_amount,
              cooperativeTier: existing.cooperatives?.cooperative_tier,
              dashboardUrl: `${config.publicAppUrl}/partner/financing/${existing.id}`,
            });
            await sb.from('notifications').insert({
              user_id: pu.user_id,
              type: 'financing_approved',
              title: 'New financing request from CoopScore',
              message: `${existing.cooperatives?.name} — ₦${Number(patch.approved_amount).toLocaleString()}`,
              metadata: { financingRequestId: existing.id },
            });
          }
        }
      } catch (e) {
        logger.warn({ err: e.message }, 'partner notification failed');
      }
    }
  } else if (decision === 'disbursed') {
    await sb.from('financing_requests').update({
      status: 'disbursed',
      disbursed_amount: approvedAmount || existing.approved_amount || existing.loan_amount,
      disbursed_at: new Date().toISOString(),
      due_date: dueDate || existing.due_date,
    }).eq('id', existing.id);
    if (submitterProfile?.email) {
      email.safe(email.sendFinancingDisbursed)(submitterProfile.email, {
        recipientName: submitterProfile.full_name,
        cooperativeName: existing.cooperatives?.name,
        amount: approvedAmount || existing.approved_amount,
        dueDate: dueDate || existing.due_date,
      });
    }
    await sb.from('notifications').insert({
      user_id: existing.submitted_by_agent_id,
      type: 'financing_disbursed',
      title: 'Financing disbursed',
      message: `Disbursement recorded for ${existing.cooperatives?.name}`,
      metadata: { financingRequestId: existing.id },
    });
  } else {
    return badRequest(res, 'Invalid decision');
  }

  await logActivity({ actor: req.user, action: `financing_${decision}`, entityType: 'financing_request', entityId: existing.id, req });
  const { data: updated } = await sb.from('financing_requests').select('*').eq('id', existing.id).maybeSingle();
  return ok(res, updated);
}

async function partnerDecide(req, res) {
  const sb = supabaseAdmin();
  const { decision, approvedAmount, partnerComments, rejectionReason } = req.body;
  const { data: existing } = await sb
    .from('financing_requests')
    .select(`*, cooperatives(name)`)
    .eq('id', req.params.requestId)
    .maybeSingle();
  if (!existing) return notFound(res);
  if (existing.forwarded_to_partner_id !== req.user.partnerId) return forbidden(res, 'Not forwarded to your organization');

  const patch = {
    partner_decision: decision,
    partner_decision_at: new Date().toISOString(),
    partner_comments: partnerComments,
  };
  if (decision === 'approved') {
    patch.approved_amount = approvedAmount || existing.approved_amount || existing.loan_amount;
  } else if (decision === 'rejected') {
    patch.rejection_reason = rejectionReason;
  }
  await sb.from('financing_requests').update(patch).eq('id', existing.id);

  const { data: admins } = await sb.from('user_roles').select('user_id').eq('role', 'super_admin');
  if (admins?.length) {
    await sb.from('notifications').insert(admins.map((a) => ({
      user_id: a.user_id,
      type: decision === 'approved' ? 'financing_approved' : 'financing_rejected',
      title: `Partner ${decision}`,
      message: `Partner ${decision} request for ${existing.cooperatives?.name}`,
      metadata: { financingRequestId: existing.id },
    })));
  }

  await logActivity({ actor: req.user, action: `partner_financing_${decision}`, entityType: 'financing_request', entityId: existing.id, req });
  const { data: updated } = await sb.from('financing_requests').select('*').eq('id', existing.id).maybeSingle();
  return ok(res, updated);
}

module.exports = { list, getById, create, adminDecide, partnerDecide };
