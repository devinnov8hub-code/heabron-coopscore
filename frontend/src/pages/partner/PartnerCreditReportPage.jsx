import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, Download } from 'lucide-react';
import api from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, MetricCard, TierPill, Skeleton, StatusPill } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { formatNaira, formatDate, formatNumber } from '@/lib/utils';

export default function PartnerCreditReportPage({ type }) {
  const params = useParams();
  const navigate = useNavigate();
  const id = type === 'farmer' ? params.farmerId : params.cooperativeId;

  const { data: report, isLoading } = useQuery({
    queryKey: ['partner-report', type, id],
    queryFn: () => api.get(`/partner/credit/${type === 'farmer' ? 'farmers' : 'cooperatives'}/${id}/report`),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!report) return <Card padded><p className="py-12 text-center">Report not available.</p></Card>;

  return type === 'farmer'
    ? <FarmerReport report={report} onBack={() => navigate(-1)} />
    : <CooperativeReport report={report} onBack={() => navigate(-1)} />;
}

function FarmerReport({ report, onBack }) {
  const f = report.subject;
  const score = report.score;
  const trend = (report.trend || []).map((h, i) => ({ idx: i + 1, score: Number(h.final_score) }));

  return (
    <>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-smoke hover:text-ink">
        <ArrowLeft className="size-4" /> Back
      </button>

      <PageHeader
        eyebrow="Credit report"
        title={f.full_name}
        description={`${f.cooperatives?.name || 'Independent'} · ${[f.lga, f.state].filter(Boolean).join(', ')}`}
        actions={<Button variant="secondary" onClick={() => window.print()}><Download className="size-4" /> Print / PDF</Button>}
      />

      {(report.riskFlags?.length || 0) > 0 && (
        <Card padded className="bg-red-50 border-red-200 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-900 mb-2">Risk indicators</p>
              <ul className="space-y-1 text-sm text-red-800">
                {report.riskFlags.map((r, i) => <li key={i}>• {r.message}</li>)}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Credit Score" value={score?.final_credit_score?.toFixed(1) || '—'} sub={score?.credit_tier ? `Tier ${score.credit_tier}` : 'Unscored'} tone="primary" />
        <MetricCard label="Production" value={score?.production_score?.toFixed(1) || '—'} sub="/ 100" />
        <MetricCard label="Repayment" value={score?.repayment_score?.toFixed(1) || '—'} sub="/ 100" />
        <MetricCard label="Loan cycles" value={formatNumber(score?.cycle_count || 0)} sub={score?.is_first_cycle ? 'First cycle' : ''} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <p className="eyebrow mb-1">Repayment breakdown</p>
          <h3 className="font-display text-xl font-semibold mb-5">Score components</h3>
          {score && (
            <div className="space-y-4">
              <BreakdownRow label="Repayment Rate" value={score.repayment_rate_score} max={60} />
              <BreakdownRow label="Timeliness" value={score.timeliness_score} max={25} />
              <BreakdownRow label="Default History" value={score.default_history_score} max={15} />
            </div>
          )}
        </Card>
        <Card>
          <p className="eyebrow mb-1">Trend</p>
          <h3 className="font-display text-xl font-semibold mb-5">Score over time</h3>
          {trend.length === 0 ? (
            <p className="text-sm text-smoke py-12 text-center">No history yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <XAxis dataKey="idx" tick={{ fontSize: 11, fill: '#6B7370' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B7370' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#2C6B47" strokeWidth={2.5} dot={{ r: 3, fill: '#2C6B47' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card padded className="mb-6">
        <p className="eyebrow mb-1">Loans</p>
        <h3 className="font-display text-xl font-semibold mb-4">Financing history</h3>
        {(report.financingHistory || []).length === 0 ? (
          <p className="text-sm text-smoke py-6 text-center">No financing history yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-smoke border-b border-whisper/60">
              <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Purpose</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Due</th>
            </tr></thead>
            <tbody>
              {report.financingHistory.map((f2) => (
                <tr key={f2.id} className="border-b border-whisper/40 last:border-0">
                  <td className="py-2 pr-4">{formatDate(f2.created_at)}</td>
                  <td className="py-2 pr-4 font-semibold">{formatNaira(f2.loan_amount)}</td>
                  <td className="py-2 pr-4">{f2.purpose}</td>
                  <td className="py-2 pr-4"><StatusPill status={f2.status} /></td>
                  <td className="py-2 pr-4">{formatDate(f2.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card padded>
        <p className="eyebrow mb-1">Repayment</p>
        <h3 className="font-display text-xl font-semibold mb-4">Recent repayments</h3>
        {(report.repaymentHistory || []).length === 0 ? (
          <p className="text-sm text-smoke py-6 text-center">No repayments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-smoke border-b border-whisper/60">
              <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Method</th><th className="py-2 pr-4">Context</th>
            </tr></thead>
            <tbody>
              {report.repaymentHistory.slice(0, 20).map((r) => (
                <tr key={r.id} className="border-b border-whisper/40 last:border-0">
                  <td className="py-2 pr-4">{formatDate(r.payment_date)}</td>
                  <td className="py-2 pr-4 font-semibold">{formatNaira(r.amount_paid)}</td>
                  <td className="py-2 pr-4 capitalize">{r.payment_method?.replace('_', ' ')}</td>
                  <td className="py-2 pr-4">{r.context_flag === 'none' ? '—' : r.context_flag}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function CooperativeReport({ report, onBack }) {
  const c = report.cooperative;
  const score = report.score;
  const trend = (report.scoreTrend || []).map((h, i) => ({ idx: i + 1, score: Number(h.final_score) }));

  return (
    <>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-smoke hover:text-ink">
        <ArrowLeft className="size-4" /> Back
      </button>

      <PageHeader
        eyebrow="Cooperative credit report"
        title={c.name}
        description={[c.lga, c.state].filter(Boolean).join(', ')}
        actions={<Button variant="secondary" onClick={() => window.print()}><Download className="size-4" /> Print / PDF</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Average score" value={score?.average_score?.toFixed(1) || '—'} sub={score?.cooperative_tier ? `Tier ${score.cooperative_tier}` : ''} tone="primary" />
        <MetricCard label="Total members" value={formatNumber(score?.total_farmers || 0)} />
        <MetricCard label="Scored members" value={formatNumber(score?.scored_farmers || 0)} />
        <MetricCard label="Tier D" value={formatNumber(score?.tier_d_count || 0)} sub="At-risk members" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <p className="eyebrow mb-1">Member distribution</p>
          <h3 className="font-display text-xl font-semibold mb-5">By tier</h3>
          <div className="space-y-2">
            {['A', 'B', 'C', 'D'].map((t) => (
              <div key={t} className="flex items-center justify-between text-sm">
                <TierPill tier={t} />
                <span className="tabular font-semibold">{formatNumber(score?.[`tier_${t.toLowerCase()}_count`] || 0)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="eyebrow mb-1">Score history</p>
          <h3 className="font-display text-xl font-semibold mb-5">Member score average</h3>
          {trend.length === 0 ? (
            <p className="text-sm text-smoke py-12 text-center">No history yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <XAxis dataKey="idx" tick={{ fontSize: 11, fill: '#6B7370' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B7370' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#2C6B47" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card padded className="mb-6">
        <p className="eyebrow mb-1">Members</p>
        <h3 className="font-display text-xl font-semibold mb-4">Cooperative members</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-smoke border-b border-whisper/60">
              <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Tier</th><th className="py-2 pr-4">Score</th>
            </tr></thead>
            <tbody>
              {(report.members || []).slice(0, 50).map((m) => {
                const s = Array.isArray(m.credit_scores) ? m.credit_scores[0] : m.credit_scores;
                return (
                  <tr key={m.id} className="border-b border-whisper/40 last:border-0">
                    <td className="py-2 pr-4 font-medium">{m.full_name}</td>
                    <td className="py-2 pr-4"><TierPill tier={s?.credit_tier} /></td>
                    <td className="py-2 pr-4 tabular">{s?.final_credit_score != null ? Number(s.final_credit_score).toFixed(1) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padded>
        <p className="eyebrow mb-1">Loans</p>
        <h3 className="font-display text-xl font-semibold mb-4">Financing history</h3>
        {(report.financingHistory || []).length === 0 ? (
          <p className="text-sm text-smoke py-6 text-center">No financing history yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-smoke border-b border-whisper/60">
              <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Purpose</th><th className="py-2 pr-4">Status</th>
            </tr></thead>
            <tbody>
              {report.financingHistory.map((f) => (
                <tr key={f.id} className="border-b border-whisper/40 last:border-0">
                  <td className="py-2 pr-4">{formatDate(f.created_at)}</td>
                  <td className="py-2 pr-4 font-semibold">{formatNaira(f.loan_amount)}</td>
                  <td className="py-2 pr-4">{f.purpose}</td>
                  <td className="py-2 pr-4"><StatusPill status={f.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function BreakdownRow({ label, value, max }) {
  const v = Number(value || 0);
  const pct = (v / max) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="font-medium">{label}</span>
        <span className="tabular text-smoke">{v.toFixed(1)} / {max}</span>
      </div>
      <div className="h-2 bg-bone rounded-full overflow-hidden">
        <div className="h-full bg-forest-500 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}
