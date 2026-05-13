'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { ok, paginated, notFound, badRequest } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../utils/activity');
const email = require('../services/email');

async function listSettlements(req, res) {
  const sb = supabaseAdmin();
  const { page, pageSize, from, to } = parsePagination(req.query);
  const status = req.query.status || 'pending';
  const { data, count, error } = await sb
    .from('settlement_requests')
    .select(`*, profiles:agent_id(full_name, email)`, { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return paginated(res, data || [], { page, pageSize, total: count || 0 });
}

async function decideSettlement(req, res) {
  const sb = supabaseAdmin();
  const { decision, adminNotes } = req.body;
  const { data: settlement } = await sb.from('settlement_requests').select(`*, profiles:agent_id(email, full_name)`).eq('id', req.params.settlementId).maybeSingle();
  if (!settlement) return notFound(res);

  if (decision === 'approve') {
    await sb.from('settlement_requests').update({
      status: 'approved',
      admin_notes: adminNotes,
      approved_by_admin_id: req.user.userId,
      approved_at: new Date().toISOString(),
    }).eq('id', settlement.id);

    // Adjust wallet balance
    const { data: wallet } = await sb.from('agent_wallets').select('*').eq('agent_id', settlement.agent_id).maybeSingle();
    if (wallet) {
      await sb.from('agent_wallets').update({ balance: Math.max(0, Number(wallet.balance) - Number(settlement.amount)) }).eq('id', wallet.id);
      await sb.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        transaction_type: 'settlement',
        amount: settlement.amount,
        description: 'Settlement approved',
        source: 'settlement_transfer',
        status: 'completed',
      });
    }

    if (settlement.profiles?.email) {
      email.safe(email.sendSettlementApproved)(settlement.profiles.email, {
        recipientName: settlement.profiles.full_name,
        amount: settlement.amount,
      });
    }
  } else if (decision === 'reject') {
    await sb.from('settlement_requests').update({
      status: 'rejected',
      admin_notes: adminNotes,
      approved_by_admin_id: req.user.userId,
      approved_at: new Date().toISOString(),
    }).eq('id', settlement.id);
  } else {
    return badRequest(res, 'decision must be approve or reject');
  }

  await logActivity({ actor: req.user, action: `settlement_${decision}d`, entityType: 'settlement', entityId: settlement.id, req });
  return ok(res, { decision });
}

async function listAllWallets(req, res) {
  const sb = supabaseAdmin();
  const { page, pageSize, from, to } = parsePagination(req.query);
  const { data, count, error } = await sb
    .from('agent_wallets')
    .select(`*, profiles:agent_id(full_name, email)`, { count: 'exact' })
    .order('balance', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return paginated(res, data || [], { page, pageSize, total: count || 0 });
}

module.exports = { listSettlements, decideSettlement, listAllWallets };
