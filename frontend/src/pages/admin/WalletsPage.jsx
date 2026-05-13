import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Check, X } from 'lucide-react';
import api from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, EmptyState, StatusPill } from '@/components/ui/Card';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Textarea } from '@/components/ui/Input';
import { formatNaira, relativeTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function WalletsPage() {
  const [tab, setTab] = useState('settlements');

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Wallets & Settlements"
        description="Approve agent payouts and monitor wallet balances across the platform."
      />

      <div className="flex items-center gap-1 border-b border-whisper/70 mb-6">
        {[
          { id: 'settlements', label: 'Settlement Requests' },
          { id: 'wallets', label: 'Agent Wallets' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id
                ? 'border-forest-500 text-forest-700'
                : 'border-transparent text-smoke hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settlements' ? <SettlementsTab /> : <WalletsTab />}
    </>
  );
}

function SettlementsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('pending');
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-settlements', status, page],
    queryFn: () =>
      api.raw.get('/admin/settlements', { params: { status, page, pageSize: 25 } }).then((r) => r.data),
  });

  const rows = data?.data || [];
  const meta = data?.meta;

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        {['pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              status === s ? 'bg-forest-500 text-white' : 'bg-white text-smoke hover:bg-bone'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <DataTable
        loading={isLoading}
        empty={<EmptyState icon={Wallet} title="No settlements" description={`No ${status} settlement requests right now.`} />}
        columns={[
          { key: 'agent', label: 'Agent', render: (r) => (
            <div>
              <p className="font-medium">{r.profiles?.full_name}</p>
              <p className="text-xs text-smoke">{r.profiles?.email}</p>
            </div>
          )},
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-semibold">{formatNaira(r.amount)}</span> },
          { key: 'bank_name', label: 'Bank' },
          { key: 'account_number', label: 'Account', render: (r) => <span className="font-mono text-xs">{r.account_number}</span> },
          { key: 'created_at', label: 'Requested', render: (r) => relativeTime(r.created_at) },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
          { key: 'actions', label: '', align: 'right', render: (r) => (
            r.status === 'pending' ? (
              <Button variant="secondary" onClick={() => setSelected(r)}>Review</Button>
            ) : <span className="text-xs text-smoke">—</span>
          )},
        ]}
        rows={rows}
      />
      {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={setPage} />}

      <DecideSettlementModal
        settlement={selected}
        onClose={() => setSelected(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['admin-settlements'] });
          setSelected(null);
        }}
      />
    </>
  );
}

function DecideSettlementModal({ settlement, onClose, onSaved }) {
  const [notes, setNotes] = useState('');
  const mutate = useMutation({
    mutationFn: ({ decision }) =>
      api.post(`/admin/settlements/${settlement.id}/decision`, { decision, adminNotes: notes }),
    onSuccess: () => {
      toast.success('Decision recorded');
      onSaved();
      setNotes('');
    },
  });

  if (!settlement) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title="Settlement decision"
      description={`${settlement.profiles?.full_name} — ${formatNaira(settlement.amount)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutate.isPending}>Cancel</Button>
          <Button variant="danger" loading={mutate.isPending && mutate.variables?.decision === 'reject'} onClick={() => mutate.mutate({ decision: 'reject' })}>
            <X className="size-4" /> Reject
          </Button>
          <Button loading={mutate.isPending && mutate.variables?.decision === 'approve'} onClick={() => mutate.mutate({ decision: 'approve' })}>
            <Check className="size-4" /> Approve
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-bone rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-smoke">Bank</p><p className="font-medium">{settlement.bank_name}</p></div>
          <div><p className="text-xs text-smoke">Account number</p><p className="font-mono">{settlement.account_number}</p></div>
          <div className="col-span-2"><p className="text-xs text-smoke">Account name</p><p className="font-medium">{settlement.account_name}</p></div>
        </div>
        <Field label="Notes" hint="Optional — visible only to admins">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for rejection, or transfer reference…" />
        </Field>
      </div>
    </Modal>
  );
}

function WalletsTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-wallets', page],
    queryFn: () => api.raw.get('/admin/wallets', { params: { page, pageSize: 25 } }).then((r) => r.data),
  });
  const rows = data?.data || [];
  const meta = data?.meta;

  return (
    <>
      <DataTable
        loading={isLoading}
        empty={<EmptyState icon={Wallet} title="No agent wallets" />}
        columns={[
          { key: 'agent', label: 'Agent', render: (r) => (
            <div>
              <p className="font-medium">{r.profiles?.full_name}</p>
              <p className="text-xs text-smoke">{r.profiles?.email}</p>
            </div>
          )},
          { key: 'balance', label: 'Balance', align: 'right', render: (r) => <span className="font-display text-lg font-semibold">{formatNaira(r.balance)}</span> },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
          { key: 'updated_at', label: 'Last activity', render: (r) => relativeTime(r.updated_at) },
        ]}
        rows={rows}
      />
      {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={setPage} />}
    </>
  );
}
