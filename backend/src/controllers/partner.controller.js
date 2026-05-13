'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { ok, paginated } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

/**
 * Universal borrower search (partner portal).
 * Returns cooperatives and farmers matching a query string, each with
 * their credit score, tier, and quick risk indicator.
 */
async function search(req, res) {
  const sb = supabaseAdmin();
  const q = (req.query.q || '').trim();
  const type = req.query.type || 'all'; // all | cooperative | farmer

  if (!q) return ok(res, { cooperatives: [], farmers: [] });

  const out = { cooperatives: [], farmers: [] };

  if (type === 'all' || type === 'cooperative') {
    const { data: coops } = await sb
      .from('cooperatives')
      .select(`id, name, state, lga, total_members, cooperative_credit_scores(average_score, cooperative_tier)`)
      .ilike('name', `%${q}%`)
      .limit(20);
    out.cooperatives = (coops || []).map((c) => {
      const s = Array.isArray(c.cooperative_credit_scores) ? c.cooperative_credit_scores[0] : c.cooperative_credit_scores;
      return {
        id: c.id,
        name: c.name,
        location: [c.lga, c.state].filter(Boolean).join(', '),
        members: c.total_members,
        score: s?.average_score ?? null,
        tier: s?.cooperative_tier ?? null,
        risk: riskLevel(s?.average_score),
      };
    });
  }

  if (type === 'all' || type === 'farmer') {
    const { data: farmers } = await sb
      .from('farmers')
      .select(`id, full_name, state, lga, credit_score, credit_tier, cooperatives(name)`)
      .ilike('full_name', `%${q}%`)
      .limit(20);
    out.farmers = (farmers || []).map((f) => ({
      id: f.id,
      name: f.full_name,
      cooperative: f.cooperatives?.name,
      location: [f.lga, f.state].filter(Boolean).join(', '),
      score: f.credit_score,
      tier: f.credit_tier,
      risk: riskLevel(f.credit_score),
    }));
  }

  return ok(res, out);
}

function riskLevel(score) {
  if (score == null) return 'unknown';
  if (score >= 80) return 'low';
  if (score >= 65) return 'moderate';
  return 'high';
}

/**
 * Portfolio monitoring: borrowers this partner has financed.
 */
async function portfolio(req, res) {
  const sb = supabaseAdmin();
  const partnerId = req.user.partnerId;

  const { data: financings } = await sb
    .from('financing_requests')
    .select(`*, cooperatives(id, name, state, lga, cooperative_credit_scores(*))`)
    .eq('forwarded_to_partner_id', partnerId);

  const byCoop = new Map();
  for (const f of financings || []) {
    const c = f.cooperatives;
    if (!c) continue;
    if (!byCoop.has(c.id)) {
      byCoop.set(c.id, {
        cooperativeId: c.id,
        name: c.name,
        state: c.state,
        lga: c.lga,
        averageScore: Array.isArray(c.cooperative_credit_scores) ? c.cooperative_credit_scores[0]?.average_score : c.cooperative_credit_scores?.average_score,
        tier: Array.isArray(c.cooperative_credit_scores) ? c.cooperative_credit_scores[0]?.cooperative_tier : c.cooperative_credit_scores?.cooperative_tier,
        totalApproved: 0,
        totalDisbursed: 0,
        loanCount: 0,
      });
    }
    const row = byCoop.get(c.id);
    row.loanCount += 1;
    if (f.partner_decision === 'approved' || f.status === 'disbursed' || f.status === 'completed') {
      row.totalApproved += Number(f.approved_amount || f.loan_amount || 0);
    }
    row.totalDisbursed += Number(f.disbursed_amount || 0);
  }

  // Aggregate distributions
  const tierDist = { A: 0, B: 0, C: 0, D: 0 };
  const stateDist = {};
  let totalAmount = 0;
  for (const v of byCoop.values()) {
    if (v.tier) tierDist[v.tier] += 1;
    if (v.state) stateDist[v.state] = (stateDist[v.state] || 0) + v.totalApproved;
    totalAmount += v.totalApproved;
  }

  return ok(res, {
    cooperatives: Array.from(byCoop.values()),
    summary: {
      totalCooperatives: byCoop.size,
      totalAmountFinanced: totalAmount,
      averageScore:
        byCoop.size > 0
          ? Array.from(byCoop.values()).reduce((s, v) => s + Number(v.averageScore || 0), 0) / byCoop.size
          : 0,
    },
    riskDistribution: tierDist,
    geographicDistribution: stateDist,
  });
}

/**
 * Watchlist: high-risk borrowers the partner has financed.
 */
async function watchlist(req, res) {
  const sb = supabaseAdmin();
  const partnerId = req.user.partnerId;
  const { data: financings } = await sb
    .from('financing_requests')
    .select('cooperative_id')
    .eq('forwarded_to_partner_id', partnerId);
  const coopIds = [...new Set((financings || []).map((f) => f.cooperative_id))];
  if (!coopIds.length) return ok(res, []);

  const { data } = await sb
    .from('cooperative_credit_scores')
    .select(`*, cooperatives(id, name, state, lga)`)
    .in('cooperative_id', coopIds)
    .in('cooperative_tier', ['C', 'D'])
    .order('average_score', { ascending: true });
  return ok(res, data || []);
}

module.exports = { search, portfolio, watchlist };
