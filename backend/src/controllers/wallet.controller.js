'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { ok, created, paginated, badRequest } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../utils/activity');
const email = require('../services/email');

async function ensureWallet(sb, agentId) {
  const { data: existing } = await sb.from('agent_wallets').select('*').eq('agent_id', agentId).maybeSingle();
  if (existing) return existing;
  const { data } = await sb.from('agent_wallets').insert({ agent_id: agentId }).select().single();
  return data;
}

async function getWallet(req, res) {
  const sb = supabaseAdmin();
  const wallet = await ensureWallet(sb, req.user.userId);
  return ok(res, wallet);
}

async function listTransactions(req, res) {
  const sb = supabaseAdmin();
  const { page, pageSize, from, to } = parsePagination(req.query);
  const wallet = await ensureWallet(sb, req.user.userId);
  const { data, count, error } = await sb
    .from('wallet_transactions')
    .select('*', { count: 'exact' })
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return paginated(res, data || [], { page, pageSize, total: count || 0 });
}

async function getTransaction(req, res) {
  const sb = supabaseAdmin();
  const wallet = await ensureWallet(sb, req.user.userId);
  const { data } = await sb.from('wallet_transactions').select('*').eq('id', req.params.transactionId).eq('wallet_id', wallet.id).maybeSingle();
  if (!data) return badRequest(res, 'Transaction not found');
  return ok(res, data);
}

async function requestSettlement(req, res) {
  const sb = supabaseAdmin();
  const wallet = await ensureWallet(sb, req.user.userId);
  const { amount, bankName, accountNumber, accountName } = req.body;

  if (amount > Number(wallet.balance)) {
    return badRequest(res, 'Amount exceeds wallet balance');
  }

  const { data, error } = await sb.from('settlement_requests').insert({
    agent_id: req.user.userId,
    amount,
    bank_name: bankName,
    account_number: accountNumber,
    account_name: accountName,
  }).select().single();
  if (error) throw error;

  // Notify admins
  const { data: admins } = await sb.from('user_roles').select('user_id, profiles(email, full_name)').eq('role', 'super_admin');
  if (admins?.length) {
    await sb.from('notifications').insert(admins.map((a) => ({
      user_id: a.user_id,
      type: 'settlement_requested',
      title: 'New settlement request',
      message: `${req.user.fullName} requested ₦${Number(amount).toLocaleString()}`,
      metadata: { settlementId: data.id },
    })));
    for (const a of admins) {
      if (a.profiles?.email) {
        email.safe(email.sendSettlementRequested)(a.profiles.email, {
          adminName: a.profiles.full_name,
          agentName: req.user.fullName,
          amount,
        });
      }
    }
  }

  await logActivity({ actor: req.user, action: 'settlement_requested', entityType: 'settlement', entityId: data.id, req });
  return created(res, data);
}

async function listSettlements(req, res) {
  const sb = supabaseAdmin();
  const { page, pageSize, from, to } = parsePagination(req.query);
  const { data, count, error } = await sb
    .from('settlement_requests')
    .select('*', { count: 'exact' })
    .eq('agent_id', req.user.userId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return paginated(res, data || [], { page, pageSize, total: count || 0 });
}

module.exports = { getWallet, listTransactions, getTransaction, requestSettlement, listSettlements };
