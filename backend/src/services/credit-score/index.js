'use strict';

/**
 * Heabron Credit Score Engine — v1.0
 *
 *   Final Credit Score = (Production Score + Repayment Score) / 2
 *   Production Score   = min(actual_yield / benchmark_yield, 1.0) * 100
 *   Repayment Score    = Repayment Rate (60) + Timeliness (25) + Default History (15)
 *
 *   Tiers (per spec section 5 & 6):
 *     A (Excellent)     90 - 100
 *     B (Good)          85 -  89
 *     C (Moderate)      75 -  84
 *     D (At risk)        0 -  74
 *
 * First-cycle farmers: only Production Score counts, capped at 84 (Tier C max)
 * until they complete a repayment cycle. Per spec section 7.
 */

const { supabaseAdmin } = require('../../config/supabase');
const logger = require('../../utils/logger');

const MODEL_VERSION = 'v1.0';

function tierForScore(score) {
  if (score >= 90) return 'A';
  if (score >= 85) return 'B';
  if (score >= 75) return 'C';
  return 'D';
}

function truncateOneDecimal(n) {
  return Math.floor(n * 10) / 10;
}

function computeProductionScore({ actualYield, benchmarkYield }) {
  if (!actualYield || !benchmarkYield || benchmarkYield <= 0) {
    return { score: 0, yieldRatio: 0 };
  }
  const ratio = Math.min(actualYield / benchmarkYield, 1.0);
  return {
    score: truncateOneDecimal(ratio * 100),
    yieldRatio: Number(ratio.toFixed(4)),
  };
}

function computeRepaymentScore({ repayments = [], loanAmount = 0, dueDate, priorDefaults = { active: false, recoveredCleanCycles: 0 } }) {
  const totalPaid = repayments.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
  const rate = loanAmount > 0 ? Math.min(totalPaid / loanAmount, 1.0) : 0;
  const repaymentRate = truncateOneDecimal(rate * 60);

  let timeliness = 25;
  if (dueDate) {
    const due = new Date(dueDate);
    let payoffDate = null;
    let cumulative = 0;
    for (const r of repayments.slice().sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date))) {
      cumulative += Number(r.amount_paid || 0);
      if (cumulative >= loanAmount) {
        payoffDate = new Date(r.payment_date);
        break;
      }
    }
    if (!payoffDate) payoffDate = new Date();

    const daysLate = Math.max(0, Math.floor((payoffDate - due) / (1000 * 60 * 60 * 24)));
    if (daysLate <= 0) timeliness = 25;
    else if (daysLate <= 30) timeliness = 20;
    else timeliness = 5;

    // Context-flagged late repayments (weather / market / health) are
    // documented but not penalised — per spec section 3.2B.
    const anyContext = repayments.some((r) => r.context_flag && r.context_flag !== 'none');
    if (anyContext && daysLate > 0) timeliness = 25;
  }

  let defaultHistory = 15;
  if (priorDefaults.active) defaultHistory = 0;
  else if (priorDefaults.recoveredCleanCycles >= 2) defaultHistory = 15;
  else if (priorDefaults.recoveredCleanCycles >= 1) defaultHistory = 8;
  else if (priorDefaults.recoveredCleanCycles > 0) defaultHistory = 8;

  const total = truncateOneDecimal(repaymentRate + timeliness + defaultHistory);
  return { score: total, components: { repaymentRate, timeliness, defaultHistory } };
}

async function lookupBenchmark(sb, { crop, state, lga, season }) {
  const tries = [
    { crop, state, lga, season },
    { crop, state, lga },
    { crop, state },
    { crop, state: 'default' },
  ];
  for (const t of tries) {
    let q = sb.from('regional_benchmarks').select('*').eq('crop', t.crop);
    if (t.state !== undefined) q = q.eq('state', t.state);
    if (t.lga !== undefined) q = q.eq('lga', t.lga);
    if (t.season !== undefined) q = q.eq('season', t.season);
    const { data } = await q.limit(1).maybeSingle();
    if (data) return Number(data.benchmark_yield_tonnes_per_hectare);
  }
  return null;
}

async function recalculateFarmerScore(farmerId, { triggerReason = 'manual' } = {}) {
  const sb = supabaseAdmin();

  const { data: farmer, error: ferr } = await sb
    .from('farmers')
    .select('*, farm_profiles(*), cooperative_id')
    .eq('id', farmerId)
    .maybeSingle();
  if (ferr) throw ferr;
  if (!farmer) throw new Error('Farmer not found');

  const { data: prod } = await sb
    .from('seasonal_productions')
    .select('*')
    .eq('farmer_id', farmerId)
    .not('actual_yield_tonnes', 'is', null)
    .order('expected_harvest_date', { ascending: false })
    .limit(1);

  const farm = farmer.farm_profiles?.[0] || farmer.farm_profiles || null;
  const farmSize = Number(farm?.farm_size_acres || 0);
  const farmSizeHa = farmSize > 0 ? farmSize * 0.404686 : 0;

  let production = { score: 0, yieldRatio: 0 };
  let isFirstCycle = true;
  if (prod && prod.length > 0 && farmSizeHa > 0) {
    isFirstCycle = false;
    const p = prod[0];
    const actualPerHa = Number(p.actual_yield_tonnes) / farmSizeHa;
    const benchmark = Number(p.benchmark_yield_tonnes) ||
      (await lookupBenchmark(sb, { crop: p.crop, state: farmer.state, lga: farmer.lga, season: p.season })) ||
      0;
    production = computeProductionScore({ actualYield: actualPerHa, benchmarkYield: benchmark });
  }

  const { data: financing } = await sb
    .from('financing_requests')
    .select('id, loan_amount, due_date, status')
    .eq('farmer_id', farmerId)
    .in('status', ['disbursed', 'completed', 'approved'])
    .order('created_at', { ascending: false })
    .limit(1);

  let repayment = { score: 0, components: { repaymentRate: 0, timeliness: 0, defaultHistory: 15 } };
  let hasActiveDefault = false;
  let cycleCount = 0;

  if (financing && financing.length > 0) {
    const f = financing[0];
    const { data: repayments } = await sb
      .from('repayment_records')
      .select('amount_paid, payment_date, context_flag')
      .eq('financing_request_id', f.id)
      .eq('voided', false);

    const { data: prior } = await sb
      .from('financing_requests')
      .select('id, loan_amount, due_date')
      .eq('farmer_id', farmerId)
      .in('status', ['disbursed', 'completed']);

    cycleCount = (prior || []).length;
    const totalPaid = (repayments || []).reduce((s, r) => s + Number(r.amount_paid || 0), 0);
    const repaymentRatio = f.loan_amount > 0 ? totalPaid / f.loan_amount : 1;
    hasActiveDefault = f.due_date && new Date(f.due_date) < new Date() && repaymentRatio < 1.0;

    repayment = computeRepaymentScore({
      repayments: repayments || [],
      loanAmount: Number(f.loan_amount || 0),
      dueDate: f.due_date,
      priorDefaults: { active: hasActiveDefault, recoveredCleanCycles: Math.max(0, cycleCount - (hasActiveDefault ? 1 : 0)) },
    });
  }

  let finalScore;
  if (isFirstCycle || !financing || financing.length === 0) {
    // First-cycle cap at Tier C maximum (spec §7)
    finalScore = truncateOneDecimal(Math.min(production.score, 84));
  } else {
    finalScore = truncateOneDecimal((production.score + repayment.score) / 2);
  }
  const tier = tierForScore(finalScore);

  const { error: upsertErr } = await sb.from('credit_scores').upsert(
    {
      farmer_id: farmerId,
      production_score: production.score,
      repayment_score: repayment.score,
      repayment_rate_score: repayment.components.repaymentRate,
      timeliness_score: repayment.components.timeliness,
      default_history_score: repayment.components.defaultHistory,
      final_credit_score: finalScore,
      credit_tier: tier,
      cycle_count: cycleCount,
      is_first_cycle: isFirstCycle,
      has_active_default: hasActiveDefault,
      model_version: MODEL_VERSION,
      last_calculated_at: new Date().toISOString(),
    },
    { onConflict: 'farmer_id' }
  );
  if (upsertErr) throw upsertErr;

  await sb.from('farmers').update({ credit_score: finalScore, credit_tier: tier }).eq('id', farmerId);

  await sb.from('credit_score_history').insert({
    farmer_id: farmerId,
    cooperative_id: farmer.cooperative_id,
    final_score: finalScore,
    credit_tier: tier,
    component_scores: {
      production: production.score,
      yieldRatio: production.yieldRatio,
      repayment: repayment.score,
      repaymentRate: repayment.components.repaymentRate,
      timeliness: repayment.components.timeliness,
      defaultHistory: repayment.components.defaultHistory,
      isFirstCycle,
      hasActiveDefault,
    },
    trigger_reason: triggerReason,
    model_version: MODEL_VERSION,
  });

  if (farmer.cooperative_id) {
    await recalculateCooperativeScore(farmer.cooperative_id);
  }

  return { farmerId, finalScore, tier, production, repayment, isFirstCycle, hasActiveDefault };
}

async function recalculateCooperativeScore(cooperativeId) {
  const sb = supabaseAdmin();

  const { data: farmers } = await sb.from('farmers').select('id').eq('cooperative_id', cooperativeId);

  if (!farmers || farmers.length === 0) {
    await sb.from('cooperative_credit_scores').upsert(
      {
        cooperative_id: cooperativeId,
        average_score: 0,
        cooperative_tier: 'D',
        total_farmers: 0,
        scored_farmers: 0,
        tier_a_count: 0,
        tier_b_count: 0,
        tier_c_count: 0,
        tier_d_count: 0,
        last_calculated_at: new Date().toISOString(),
      },
      { onConflict: 'cooperative_id' }
    );
    await sb.from('cooperatives').update({ average_credit_score: 0, cooperative_tier: 'D', total_members: 0 }).eq('id', cooperativeId);
    return { cooperativeId, averageScore: 0, tier: 'D' };
  }

  const ids = farmers.map((f) => f.id);
  const { data: scores } = await sb
    .from('credit_scores')
    .select('farmer_id, final_credit_score, production_score, is_first_cycle, credit_tier')
    .in('farmer_id', ids);

  const counts = { A: 0, B: 0, C: 0, D: 0 };
  let sum = 0;
  let scored = 0;
  for (const s of scores || []) {
    // First-cycle members contribute Production Score only (spec §7 + §6.3)
    const v = s.is_first_cycle ? Number(s.production_score) : Number(s.final_credit_score);
    sum += v;
    scored += 1;
    if (s.credit_tier) counts[s.credit_tier] = (counts[s.credit_tier] || 0) + 1;
  }
  const avg = scored > 0 ? truncateOneDecimal(sum / scored) : 0;
  const tier = tierForScore(avg);

  await sb.from('cooperative_credit_scores').upsert(
    {
      cooperative_id: cooperativeId,
      average_score: avg,
      cooperative_tier: tier,
      total_farmers: farmers.length,
      scored_farmers: scored,
      tier_a_count: counts.A,
      tier_b_count: counts.B,
      tier_c_count: counts.C,
      tier_d_count: counts.D,
      last_calculated_at: new Date().toISOString(),
    },
    { onConflict: 'cooperative_id' }
  );

  await sb
    .from('cooperatives')
    .update({ average_credit_score: avg, cooperative_tier: tier, total_members: farmers.length })
    .eq('id', cooperativeId);

  return { cooperativeId, averageScore: avg, tier, counts };
}

async function safeRecalculateFarmer(farmerId, opts) {
  try {
    return await recalculateFarmerScore(farmerId, opts);
  } catch (err) {
    logger.warn({ err: err.message, farmerId }, 'farmer score recalc failed');
    return null;
  }
}

async function safeRecalculateCooperative(cooperativeId) {
  try {
    return await recalculateCooperativeScore(cooperativeId);
  } catch (err) {
    logger.warn({ err: err.message, cooperativeId }, 'cooperative score recalc failed');
    return null;
  }
}

module.exports = {
  MODEL_VERSION,
  tierForScore,
  computeProductionScore,
  computeRepaymentScore,
  recalculateFarmerScore,
  recalculateCooperativeScore,
  safeRecalculateFarmer,
  safeRecalculateCooperative,
};
