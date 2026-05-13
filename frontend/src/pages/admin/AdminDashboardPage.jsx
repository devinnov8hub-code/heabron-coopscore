import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, Sprout, UserCheck, FileCheck, Banknote, TrendingUp, ArrowUpRight,
} from 'lucide-react';
import api from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard, Card, TierPill, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatNaira, formatNumber, relativeTime } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const TIER_COLORS = { A: '#2C6B47', B: '#4F8E6C', C: '#E0A82E', D: '#C84B4B' };

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard'),
  });

  const tierData = data
    ? Object.entries(data.cooperativeTierDistribution || {}).map(([tier, count]) => ({ name: `Tier ${tier}`, value: count, tier }))
    : [];

  const financingData = data
    ? Object.entries(data.financing || {}).map(([status, count]) => ({ status, count }))
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Welcome to CoopScore Admin"
        description="Operational health of the cooperative credit platform at a glance."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/admin/applications')}>
              Review applications
            </Button>
            <Button onClick={() => navigate('/admin/partners')}>
              <Users className="size-4" /> Manage partners
            </Button>
          </>
        }
      />

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </>
        ) : (
          <>
            <MetricCard
              label="Farmers"
              value={formatNumber(data?.totals.farmers)}
              icon={Sprout}
              tone="primary"
            />
            <MetricCard
              label="Cooperatives"
              value={formatNumber(data?.totals.cooperatives)}
              icon={Users}
            />
            <MetricCard
              label="Field Agents"
              value={formatNumber(data?.totals.fieldAgents)}
              icon={UserCheck}
            />
            <MetricCard
              label="Total Disbursed"
              value={formatNaira(data?.totalDisbursed)}
              icon={Banknote}
              tone="accent"
            />
          </>
        )}
      </div>

      {/* Pending callouts */}
      {data?.totals?.pendingApplications > 0 && (
        <Card padded className="mb-6 bg-harvest-50 border-harvest-200">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-xl bg-harvest-400 text-forest-800 flex items-center justify-center">
              <FileCheck className="size-6" />
            </div>
            <div className="flex-1">
              <p className="font-display text-lg font-semibold">{data.totals.pendingApplications} agent {data.totals.pendingApplications === 1 ? 'application' : 'applications'} awaiting review</p>
              <p className="text-sm text-smoke">New field agents have submitted their KYC and are waiting to be activated.</p>
            </div>
            <Button onClick={() => navigate('/admin/applications')}>
              Review now <ArrowUpRight className="size-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="eyebrow">Distribution</p>
              <h3 className="font-display text-xl font-semibold">Cooperatives by Tier</h3>
            </div>
          </div>
          {tierData.length === 0 || tierData.every((d) => d.value === 0) ? (
            <p className="text-sm text-smoke py-12 text-center">No scored cooperatives yet</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={tierData.filter((d) => d.value > 0)}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {tierData.map((d) => (
                      <Cell key={d.tier} fill={TIER_COLORS[d.tier]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {tierData.map((d) => (
                  <div key={d.tier} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2.5 rounded-sm" style={{ background: TIER_COLORS[d.tier] }} />
                      <TierPill tier={d.tier} />
                    </div>
                    <span className="font-display text-2xl font-semibold tabular">{formatNumber(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="eyebrow">Financing</p>
              <h3 className="font-display text-xl font-semibold">Requests by Status</h3>
            </div>
            <Button variant="ghost" onClick={() => navigate('/admin/financing')}>
              View all <ArrowUpRight className="size-4" />
            </Button>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={financingData}>
              <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#6B7370' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7370' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #E8E5D9', borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="count" fill="#2C6B47" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="eyebrow">Live feed</p>
            <h3 className="font-display text-xl font-semibold">Recent Activity</h3>
          </div>
          <Button variant="ghost" onClick={() => navigate('/admin/activity')}>
            Full log <ArrowUpRight className="size-4" />
          </Button>
        </div>
        <div className="space-y-3">
          {(data?.recentActivity || []).slice(0, 10).map((a) => (
            <div key={a.id} className="flex items-start gap-3 py-2 border-b border-whisper/40 last:border-0">
              <div className="size-9 rounded-lg bg-bone flex items-center justify-center text-forest-500 text-sm font-bold mt-0.5">
                <TrendingUp className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium text-ink">{a.action.replace(/_/g, ' ')}</span>
                  {a.entity_type && <span className="text-smoke"> · {a.entity_type}</span>}
                </p>
                <p className="text-xs text-smoke">{relativeTime(a.created_at)}</p>
              </div>
            </div>
          ))}
          {(!data?.recentActivity || data.recentActivity.length === 0) && (
            <p className="text-sm text-smoke text-center py-8">No recent activity</p>
          )}
        </div>
      </Card>
    </>
  );
}
