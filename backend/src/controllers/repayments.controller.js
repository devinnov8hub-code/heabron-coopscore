'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { ok, created, notFound, forbidden, paginated, badRequest } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../utils/activity');
const { safeRecalculateFarmer } = require('../services/credit-score');
const email = require('../services/email');

async function list(req, res) {
  const sb = supabaseAdmin();
  const { page, pageSize, from, to } = parsePagination(req.query);
  const { startDate, endDate } = req.query;

  let q = sb.from('repayment_records').select(
    `*, farmers(id, full_name), financing_requests(id, loan_amount, cooperative_id, cooperatives(name))`,
    { count: 'exact' }
  );
  if (req.user.role === 'field_agent') q = q.eq('recorded_by_agent_id', req.user.userId);
  if (startDate) q = q.gte('payment_date', startDate);
  if (endDate) q = q.lte('payment_date', endDate);
  q = q.order('payment_date', { ascending: false }).range(from, to);
  const { data, count, error } = await q;
  if (error) throw error;
  return paginated(res, data || [], { page, pageSize, total: count || 0 });
}

async function create(req, res) {
  const sb = supabaseAdmin();
  const body = req.body;

  const { data: financing } = await sb
    .from('financing_requests')
    .select(`*, cooperatives(name), profiles:submitted_by_agent_id(email, full_name)`)
    .eq('id', body.financingRequestId)
    .maybeSingle();
  if (!financing) return notFound(res, 'Financing request not found');
  if (!['disbursed', 'approved'].includes(financing.status)) {
    return badRequest(res, 'Cannot record repayment on a request that has not been disbursed/approved');
  }

  // Authorization
  if (req.user.role === 'field_agent' && financing.submitted_by_agent_id !== req.user.userId) {
    return forbidden(res, 'You are not the submitting agent for this loan');
  }

  const { data: farmer } = await sb.from('farmers').select('id, full_name').eq('id', body.farmerId).maybeSingle();
  if (!farmer) return notFound(res, 'Farmer not found');

  const { data, error } = await sb.from('repayment_records').insert({
    financing_request_id: body.financingRequestId,
    farmer_id: body.farmerId,
    amount_paid: body.amountPaid,
    payment_date: body.paymentDate || new Date().toISOString().slice(0, 10),
    payment_method: body.paymentMethod,
    reference_number: body.referenceNumber,
    proof_photo_url: body.proofPhotoUrl,
    context_flag: body.contextFlag || 'none',
    context_notes: body.contextNotes,
    recorded_by_agent_id: req.user.userId,
  }).select().single();
  if (error) throw error;

  // Compute outstanding balance
  const { data: payments } = await sb.from('repayment_records').select('amount_paid').eq('financing_request_id', body.financingRequestId);
  const totalPaid = (payments || []).reduce((s, r) => s + Number(r.amount_paid), 0);
  const outstanding = Number(financing.loan_amount) - totalPaid;

  // Mark complete if paid in full
  if (outstanding <= 0) {
    await sb.from('financing_requests').update({ status: 'completed' }).eq('id', body.financingRequestId);
  }

  // Recalc score
  safeRecalculateFarmer(body.farmerId, { triggerReason: 'repayment_recorded' });

  // Notify + email agent
  await sb.from('notifications').insert({
    user_id: req.user.userId,
    type: 'repayment_recorded',
    title: 'Repayment recorded',
    message: `₦${Number(body.amountPaid).toLocaleString()} from ${farmer.full_name}`,
    metadata: { repaymentId: data.id, financingRequestId: body.financingRequestId },
  });
  if (financing.profiles?.email) {
    email.safe(email.sendRepaymentRecorded)(financing.profiles.email, {
      recipientName: financing.profiles.full_name,
      farmerName: farmer.full_name,
      amount: body.amountPaid,
      outstandingBalance: Math.max(0, outstanding),
    });
  }
  await logActivity({ actor: req.user, action: 'repayment_recorded', entityType: 'repayment', entityId: data.id, req });

  return created(res, { ...data, outstandingBalance: Math.max(0, outstanding) });
}

module.exports = { list, create };
