import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, AlertTriangle, ShieldCheck, Sprout, MapPin, Phone } from 'lucide-react';
import api from '@/lib/api';
import { Card, MetricCard, TierPill, Skeleton, StatusPill } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { formatDate, formatNaira, formatNumber } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function FarmerDetailPage() {
  const { farmerId } = useParams();
  const navigate = useNavigate();

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['admin-farmer-report', farmerId],
    queryFn: () => api.get(`/admin/credit/farmers/${farmerId}/report`),
  });

  const recalc = useMutation({
    mutationFn: () => api.post(`/admin/credit/farmers/${farmerId}/recalculate`),
    onSuccess: () => { toast.success('Score recalculated'); refetch(); },
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }
  if (!report?.subject) {
    return <Card><p className="text-center py-12">Farmer not found.</p></Card>;
  }

  const f = report.subject;
  const score = report.score;
  const trend = (report.trend || []).map((h, i) => ({ idx: i + 1, score: Number(h.final_score), date: h.calculated_at }));

  return (
    <>
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-sm text-smoke hover:text-ink">
        <ArrowLeft className="size-4" /> Back
      </button>

      <PageHeader
        eyebrow={f.cooperatives?.name || 'Farmer'}
        title={f.full_name}
        description={[f.lga, f.state].filter(Boolean).join(', ')}
        actions={
          <Button onClick={() => recalc.mutate()} loading={recalc.isPending}>
            <RefreshCw className="size-4" /> Recalculate score
          </Button>
        }
      />

      {/* Risk flags */}
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

      {/* Score row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Credit Score"
          value={score?.final_credit_score?.toFixed(1) || '—'}
          sub={score?.credit_tier ? `Tier ${score.credit_tier}` : 'Unscored'}
          tone="primary"
        />
        <MetricCard
          label="Production"
          value={score?.production_score?.toFixed(1) || '—'}
          sub="/ 100"
        />
        <MetricCard
          label="Repayment"
          value={score?.repayment_score?.toFixed(1) || '—'}
          sub="/ 100"
        />
        <MetricCard
          label="Loan Cycles"
          value={formatNumber(score?.cycle_count || 0)}
          sub={score?.is_first_cycle ? 'First cycle' : 'Established'}
        />
      </div>

      {/* Score breakdown + trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <p className="eyebrow mb-1">Repayment breakdown</p>
          <h3 className="font-display text-xl font-semibold mb-5">Score components</h3>
          {score ? (
            <div className="space-y-4">
              <BreakdownRow label="Repayment Rate" value={score.repayment_rate_score} max={60} />
              <BreakdownRow label="Timeliness" value={score.timeliness_score} max={25} />
              <BreakdownRow label="Default History" value={score.default_history_score} max={15} />
            </div>
          ) : (
            <p className="text-sm text-smoke py-8 text-center">No score available yet.</p>
          )}
        </Card>

        <Card>
          <p className="eyebrow mb-1">History</p>
          <h3 className="font-display text-xl font-semibold mb-5">Score trend</h3>
          {trend.length === 0 ? (
            <p className="text-sm text-smoke py-12 text-center">No score history yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <XAxis dataKey="idx" tick={{ fontSize: 11, fill: '#6B7370' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B7370' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #E8E5D9', borderRadius: 12 }} />
                <Line type="monotone" dataKey="score" stroke="#2C6B47" strokeWidth={2.5} dot={{ r: 3, fill: '#2C6B47' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Personal info */}
      <Card padded className="mb-6">
        <p className="eyebrow mb-1">Profile</p>
        <h3 className="font-display text-xl font-semibold mb-5">Farmer details</h3>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <KV label="Date of birth" value={formatDate(f.date_of_birth)} />
          <KV label="Gender" value={f.gender || '—'} />
          <KV label="Phone" value={f.phone || '—'} icon={Phone} />
          <KV label="NIN status" value={
            <span className="inline-flex items-center gap-1.5">
              {f.nin_verification_status === 'verified' && <ShieldCheck className="size-3.5 text-forest-500" />}
              <StatusPill status={f.nin_verification_status} />
            </span>
          } />
          <KV label="Household size" value={formatNumber(f.household_size)} />
          <KV label="Dependents" value={formatNumber(f.dependents)} />
          <KV label="Education" value={f.education_level || '—'} />
          <KV label="Address" value={f.address || '—'} />
        </dl>

        {f.farm_profiles?.[0] && (
          <>
            <hr className="my-6 border-whisper/60" />
            <p className="eyebrow mb-1">Farm</p>
            <h4 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <Sprout className="size-4 text-forest-500" /> Production profile
            </h4>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <KV label="Primary crop" value={f.farm_profiles[0].crop_type} />
              <KV label="Farm size" value={`${f.farm_profiles[0].farm_size_acres} acres`} />
              <KV label="Soil type" value={f.farm_profiles[0].soil_type || '—'} />
              <KV label="Irrigation" value={f.farm_profiles[0].irrigation_access ? 'Yes' : 'No'} />
              <KV label="Years of experience" value={f.farm_profiles[0].years_experience} />
              <KV label="Land ownership" value={f.farm_profiles[0].land_ownership || '—'} />
            </dl>
          </>
        )}
      </Card>

      {/* Financing history */}
      <Card padded className="mb-6">
        <p className="eyebrow mb-1">Loans</p>
        <h3 className="font-display text-xl font-semibold mb-4">Financing history</h3>
        {(report.financingHistory || []).length === 0 ? (
          <p className="text-sm text-smoke py-6 text-center">No financing history yet.</p>
        ) : (
          <div className="overflow-x-auto">
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
          </div>
        )}
      </Card>

      {/* Recent deliveries */}
      <Card padded>
        <p className="eyebrow mb-1">Production</p>
        <h3 className="font-display text-xl font-semibold mb-4">Recent deliveries</h3>
        {(report.recentDeliveries || []).length === 0 ? (
          <p className="text-sm text-smoke py-6 text-center">No deliveries recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-smoke border-b border-whisper/60">
                <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Crop</th><th className="py-2 pr-4">Quantity</th><th className="py-2 pr-4">Grade</th><th className="py-2 pr-4">Value</th>
              </tr></thead>
              <tbody>
                {report.recentDeliveries.map((d) => (
                  <tr key={d.id} className="border-b border-whisper/40 last:border-0">
                    <td className="py-2 pr-4">{formatDate(d.date_delivered)}</td>
                    <td className="py-2 pr-4 capitalize">{d.crop}</td>
                    <td className="py-2 pr-4">{formatNumber(d.quantity_kg)} kg</td>
                    <td className="py-2 pr-4">{d.quality_grade ? <TierPill tier={d.quality_grade} /> : '—'}</td>
                    <td className="py-2 pr-4">{formatNaira(d.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function KV({ label, value, icon: Icon }) {
  return (
    <div>
      <p className="text-xs text-smoke uppercase tracking-wider mb-0.5 flex items-center gap-1">
        {Icon && <Icon className="size-3" />}{label}
      </p>
      <p className="font-medium text-ink">{value}</p>
    </div>
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
